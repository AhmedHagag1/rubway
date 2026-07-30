from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session, selectinload

from app.core.config import TELEGRAM_CHAT_ID, TELEGRAM_WEBHOOK_SECRET
from app.database.database import get_db
from app.models.payment_account import PaymentAccount
from app.models.transfer import Transfer
from app.services.admin_transfer_service import complete_transfer, confirm_payment, mark_rub_sent, reject_transfer
from app.services.payment_account_service import evaluate_account_after_payment
from app.services.telegram_service import (
    answer_callback,
    edit_telegram_message,
    format_money,
    format_transfer_message,
    send_telegram_message,
    transfer_keyboard,
)

router = APIRouter(prefix="/telegram", tags=["Telegram Bot"])


def _authorized_chat(chat_id: str | int | None) -> bool:
    return bool(chat_id is not None and str(chat_id) == str(TELEGRAM_CHAT_ID))


def _load_transfer(db: Session, transfer_id: int) -> Transfer | None:
    return (
        db.query(Transfer)
        .options(selectinload(Transfer.russian_recipient), selectinload(Transfer.payment_account))
        .filter(Transfer.id == transfer_id)
        .first()
    )


def _accounts_keyboard(accounts: list[PaymentAccount]) -> dict:
    rows = []
    for account in accounts:
        icon = "✅" if account.is_active else "⛔"
        rows.append([
            {"text": f"{icon} {account.name}", "callback_data": f"account:view:{account.id}"},
            {"text": "تعطيل" if account.is_active else "تفعيل", "callback_data": f"account:toggle:{account.id}"},
        ])
    rows.append([{"text": "🔄 تحديث", "callback_data": "accounts:list"}])
    return {"inline_keyboard": rows}


async def _show_accounts(db: Session, chat_id: str, message_id: int | None = None) -> None:
    accounts = db.query(PaymentAccount).order_by(PaymentAccount.priority.asc(), PaymentAccount.id.asc()).all()
    text = "💳 <b>حسابات الدفع</b>\n\n"
    if not accounts:
        text += "لا توجد حسابات دفع مسجلة."
    else:
        for account in accounts:
            usage = evaluate_account_after_payment(db, account)
            state = "نشط" if account.is_active else "متوقف"
            text += (
                f"<b>#{account.id} — {account.name}</b> ({state})\n"
                f"<code>{account.account_number}</code> — {account.account_holder_name}\n"
                f"اليومي: {format_money(usage['used_today'])} / {format_money(account.daily_limit)} EGP\n"
                f"الشهري: {format_money(usage['used_this_month'])} / {format_money(account.monthly_limit)} EGP\n\n"
            )
    keyboard = _accounts_keyboard(accounts)
    if message_id:
        await edit_telegram_message(chat_id, message_id, text, keyboard)
    else:
        await send_telegram_message(text, keyboard, chat_id)


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
):
    if TELEGRAM_WEBHOOK_SECRET and x_telegram_bot_api_secret_token != TELEGRAM_WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="Invalid Telegram webhook secret")

    update = await request.json()
    message = update.get("message") or {}
    callback = update.get("callback_query") or {}

    if message:
        chat_id = message.get("chat", {}).get("id")
        if not _authorized_chat(chat_id):
            return {"ok": True}
        text = (message.get("text") or "").strip().lower()
        if text in {"/start", "/menu"}:
            keyboard = {
                "inline_keyboard": [
                    [{"text": "📥 أحدث الطلبات", "callback_data": "transfers:latest"}],
                    [{"text": "💳 حسابات الدفع", "callback_data": "accounts:list"}],
                ]
            }
            await send_telegram_message("🤖 <b>إدارة RUBWAY</b>\nاختر العملية المطلوبة:", keyboard, str(chat_id))
        elif text in {"/accounts", "حسابات"}:
            await _show_accounts(db, str(chat_id))
        return {"ok": True}

    if callback:
        callback_id = callback.get("id")
        chat_id = callback.get("message", {}).get("chat", {}).get("id")
        message_id = callback.get("message", {}).get("message_id")
        data = callback.get("data") or ""
        if not _authorized_chat(chat_id):
            await answer_callback(callback_id, "غير مصرح")
            return {"ok": True}

        try:
            if data == "accounts:list":
                await _show_accounts(db, str(chat_id), message_id)
                await answer_callback(callback_id)
                return {"ok": True}

            if data == "transfers:latest":
                transfers = (
                    db.query(Transfer)
                    .options(selectinload(Transfer.russian_recipient), selectinload(Transfer.payment_account))
                    .order_by(Transfer.created_at.desc())
                    .limit(10)
                    .all()
                )
                await answer_callback(callback_id)
                for transfer in reversed(transfers):
                    await send_telegram_message(format_transfer_message(transfer), transfer_keyboard(transfer), str(chat_id))
                return {"ok": True}

            parts = data.split(":")
            if len(parts) != 3:
                await answer_callback(callback_id, "أمر غير معروف")
                return {"ok": True}
            entity, action, raw_id = parts
            item_id = int(raw_id)

            if entity == "account":
                account = db.query(PaymentAccount).filter(PaymentAccount.id == item_id).first()
                if not account:
                    raise ValueError("الحساب غير موجود")
                if action == "toggle":
                    account.is_active = not account.is_active
                    db.commit()
                    await _show_accounts(db, str(chat_id), message_id)
                    await answer_callback(callback_id, "تم تحديث الحساب")
                elif action == "view":
                    usage = evaluate_account_after_payment(db, account)
                    text = (
                        f"💳 <b>{account.name}</b>\n"
                        f"النوع: {account.account_type}\n"
                        f"الرقم: <code>{account.account_number}</code>\n"
                        f"صاحب الحساب: {account.account_holder_name}\n"
                        f"الأولوية: {account.priority}\n"
                        f"اليومي: {format_money(usage['used_today'])} / {format_money(account.daily_limit)} EGP\n"
                        f"الشهري: {format_money(usage['used_this_month'])} / {format_money(account.monthly_limit)} EGP"
                    )
                    await edit_telegram_message(str(chat_id), message_id, text, {"inline_keyboard": [[{"text": "⬅️ رجوع", "callback_data": "accounts:list"}]]})
                    await answer_callback(callback_id)
                return {"ok": True}

            if entity == "transfer":
                if action == "confirm":
                    confirm_payment(db, item_id)
                elif action == "sent":
                    mark_rub_sent(db, item_id)
                elif action == "complete":
                    complete_transfer(db, item_id)
                elif action == "reject":
                    reject_transfer(db, item_id, "تم رفض الطلب من بوت تيليجرام")
                elif action != "view":
                    raise ValueError("إجراء غير معروف")

                transfer = _load_transfer(db, item_id)
                if not transfer:
                    raise ValueError("الطلب غير موجود")
                await edit_telegram_message(str(chat_id), message_id, format_transfer_message(transfer), transfer_keyboard(transfer))
                await answer_callback(callback_id, "تم تحديث الطلب")
                return {"ok": True}

        except (ValueError, TypeError) as error:
            db.rollback()
            await answer_callback(callback_id, str(error)[:180])
            return {"ok": True}

    return {"ok": True}

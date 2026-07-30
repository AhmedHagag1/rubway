import logging
from decimal import Decimal
from html import escape

import httpx

from app.core.config import BACKEND_PUBLIC_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
from app.models.transfer import Transfer

logger = logging.getLogger(__name__)


def is_telegram_configured() -> bool:
    return bool(TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)


def format_money(value: Decimal | float) -> str:
    return f"{Decimal(value):,.2f}"


def format_optional_value(value: str | None, fallback: str = "غير متوفر") -> str:
    return escape(str(value)) if value else fallback


def recipient_block(transfer: Transfer) -> str:
    recipient = transfer.russian_recipient
    if recipient is None:
        return "\n🇷🇺 <b>بيانات المستلم:</b> غير مسجلة"
    details = [
        "\n🇷🇺 <b>بيانات المستلم في روسيا</b>",
        f"<b>الاسم:</b> {escape(recipient.recipient_name)}",
        f"<b>البنك:</b> {escape(recipient.bank_name)}",
        f"<b>الهاتف:</b> {escape(recipient.recipient_phone)}",
    ]
    if recipient.sbp_phone:
        details.append(f"<b>SBP:</b> <code>{escape(recipient.sbp_phone)}</code>")
    if recipient.card_number:
        details.append(f"<b>البطاقة:</b> <code>{escape(recipient.card_number)}</code>")
    if recipient.account_number:
        details.append(f"<b>الحساب:</b> <code>{escape(recipient.account_number)}</code>")
    return "\n".join(details)


def transfer_keyboard(transfer: Transfer) -> dict:
    rows = []
    if transfer.receipt_path:
        rows.append([{"text": "🧾 عرض إيصال العميل", "url": f"{BACKEND_PUBLIC_URL}/receipts/{transfer.receipt_path.split('/')[-1]}"}])
    if transfer.status == "payment_proof_uploaded":
        rows.append([
            {"text": "✅ تأكيد استلام الجنيه", "callback_data": f"transfer:confirm:{transfer.id}"},
            {"text": "❌ رفض", "callback_data": f"transfer:reject:{transfer.id}"},
        ])
    elif transfer.status == "ready_to_send":
        rows.append([{"text": "💸 تم إرسال الروبل", "callback_data": f"transfer:sent:{transfer.id}"}])
    elif transfer.status == "rub_sent":
        rows.append([{"text": "✅ إتمام الطلب", "callback_data": f"transfer:complete:{transfer.id}"}])
    rows.append([{"text": "🔄 تحديث الطلب", "callback_data": f"transfer:view:{transfer.id}"}])
    return {"inline_keyboard": rows}


def format_transfer_message(transfer: Transfer, title: str = "🟢 <b>طلب RUBWAY</b>") -> str:
    account = transfer.payment_account
    account_text = "غير محدد"
    if account:
        account_text = f"{escape(account.name)} — <code>{escape(account.account_number)}</code>"
    return (
        f"{title}\n\n"
        f"<b>رقم الطلب:</b> #{transfer.id}\n"
        f"<b>العميل:</b> {format_optional_value(transfer.customer_name)}\n"
        f"<b>هاتف العميل:</b> {format_optional_value(transfer.customer_phone)}\n"
        f"<b>تيليجرام:</b> {format_optional_value(transfer.telegram_username)}\n\n"
        f"<b>المبلغ:</b> {format_money(transfer.egp_amount)} EGP → {format_money(transfer.rub_amount)} RUB\n"
        f"<b>طريقة الدفع:</b> {escape(transfer.payment_method)}\n"
        f"<b>حساب الاستلام:</b> {account_text}\n"
        f"<b>الحالة:</b> {escape(transfer.status)}\n"
        f"{recipient_block(transfer)}"
    )


async def telegram_api(method: str, payload: dict) -> dict | None:
    if not is_telegram_configured():
        return None
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/{method}",
                json=payload,
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError:
        logger.exception("Telegram API request failed: %s", method)
        return None


async def send_telegram_message(message: str, reply_markup: dict | None = None, chat_id: str | None = None) -> bool:
    payload = {
        "chat_id": chat_id or TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML",
        "disable_web_page_preview": True,
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup
    return await telegram_api("sendMessage", payload) is not None


async def edit_telegram_message(chat_id: str, message_id: int, message: str, reply_markup: dict | None = None) -> bool:
    payload = {"chat_id": chat_id, "message_id": message_id, "text": message, "parse_mode": "HTML", "disable_web_page_preview": True}
    if reply_markup:
        payload["reply_markup"] = reply_markup
    return await telegram_api("editMessageText", payload) is not None


async def answer_callback(callback_query_id: str, text: str = "تم") -> None:
    await telegram_api("answerCallbackQuery", {"callback_query_id": callback_query_id, "text": text})


async def notify_transfer_created(transfer: Transfer) -> bool:
    return await send_telegram_message(format_transfer_message(transfer, "🟢 <b>طلب تحويل جديد</b>"), transfer_keyboard(transfer))


async def notify_receipt_uploaded(transfer: Transfer) -> bool:
    return await send_telegram_message(format_transfer_message(transfer, "🧾 <b>تم رفع إيصال جديد</b>"), transfer_keyboard(transfer))


async def notify_payment_account_limit(account, usage: dict) -> bool:
    level = usage.get("level", "normal")
    if level == "normal":
        return False
    icon = "⛔" if level == "limit_reached" else "⚠️"
    message = (
        f"{icon} <b>تنبيه حد حساب الدفع</b>\n\n"
        f"<b>الحساب:</b> {escape(account.name)}\n"
        f"<b>الرقم:</b> {escape(usage['masked_account_number'])}\n"
        f"<b>المستخدم اليوم:</b> {format_money(usage['used_today'])} EGP\n"
        f"<b>المتبقي اليوم:</b> {format_money(usage['remaining_today'])} EGP\n"
        f"<b>المستخدم شهريًا:</b> {format_money(usage['used_this_month'])} EGP\n"
        f"<b>الحالة:</b> {escape(level)}"
    )
    return await send_telegram_message(message)

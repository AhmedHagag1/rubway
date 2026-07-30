from datetime import datetime, time, timezone
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.payment_account import PaymentAccount
from app.models.transfer import Transfer
from app.models.transfer_status import TransferStatus
from app.schemas.payment_account import PaymentAccountCreate, PaymentAccountUpdate

EGYPT_TZ = ZoneInfo("Africa/Cairo")
COUNTED_STATUSES = {
    TransferStatus.WAITING_RECIPIENT.value,
    TransferStatus.READY_TO_SEND.value,
    TransferStatus.RUB_SENT.value,
    TransferStatus.COMPLETED.value,
}


def _utc_bounds() -> tuple[datetime, datetime, datetime]:
    now_egypt = datetime.now(EGYPT_TZ)
    day_start = datetime.combine(now_egypt.date(), time.min, tzinfo=EGYPT_TZ)
    month_start = day_start.replace(day=1)
    return now_egypt.astimezone(timezone.utc), day_start.astimezone(timezone.utc), month_start.astimezone(timezone.utc)


def _sum_usage(db: Session, account_id: int, start: datetime) -> Decimal:
    value = (
        db.query(func.coalesce(func.sum(Transfer.egp_amount), 0))
        .filter(
            Transfer.payment_account_id == account_id,
            Transfer.status.in_(COUNTED_STATUSES),
            Transfer.payment_confirmed_at.is_not(None),
            Transfer.payment_confirmed_at >= start,
        )
        .scalar()
    )
    return Decimal(value or 0).quantize(Decimal("0.01"))


def get_usage(db: Session, account: PaymentAccount) -> dict:
    _, day_start, month_start = _utc_bounds()
    used_today = _sum_usage(db, account.id, day_start)
    used_month = _sum_usage(db, account.id, month_start)
    daily_limit = Decimal(account.daily_limit)
    monthly_limit = Decimal(account.monthly_limit)
    percent = lambda used, limit: ((used / limit) * 100).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP) if limit else Decimal("0")
    number = account.account_number
    masked = ("*" * max(len(number) - 4, 0)) + number[-4:]
    return {
        "used_today": used_today,
        "remaining_today": max(daily_limit - used_today, Decimal("0")),
        "used_this_month": used_month,
        "remaining_this_month": max(monthly_limit - used_month, Decimal("0")),
        "daily_usage_percent": percent(used_today, daily_limit),
        "monthly_usage_percent": percent(used_month, monthly_limit),
        "masked_account_number": masked,
    }


def choose_account(db: Session, account_type: str, amount: Decimal) -> PaymentAccount:
    accounts = (
        db.query(PaymentAccount)
        .filter(PaymentAccount.account_type == account_type, PaymentAccount.is_active.is_(True))
        .order_by(PaymentAccount.priority.asc(), PaymentAccount.id.asc())
        .with_for_update()
        .all()
    )
    for account in accounts:
        usage = get_usage(db, account)
        if usage["remaining_today"] >= amount and usage["remaining_this_month"] >= amount:
            return account
    raise ValueError("No active payment account has enough daily and monthly capacity")


def create_account(db: Session, data: PaymentAccountCreate) -> PaymentAccount:
    account = PaymentAccount(**data.model_dump())
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


def update_account(db: Session, account_id: int, data: PaymentAccountUpdate) -> PaymentAccount:
    account = db.query(PaymentAccount).filter(PaymentAccount.id == account_id).first()
    if account is None:
        raise ValueError("Payment account not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(account, key, value)
    db.commit()
    db.refresh(account)
    return account


def list_accounts(db: Session) -> list[dict]:
    accounts = db.query(PaymentAccount).order_by(PaymentAccount.priority.asc(), PaymentAccount.id.asc()).all()
    return [{**{c.name: getattr(a, c.name) for c in a.__table__.columns}, **get_usage(db, a)} for a in accounts]


def evaluate_account_after_payment(db: Session, account: PaymentAccount) -> dict:
    usage = get_usage(db, account)
    max_percent = max(usage["daily_usage_percent"], usage["monthly_usage_percent"])
    level = "normal"
    if usage["remaining_today"] <= 0 or usage["remaining_this_month"] <= 0:
        account.is_active = False
        db.commit()
        level = "limit_reached"
    elif max_percent >= Decimal(account.critical_threshold):
        level = "critical"
    elif max_percent >= Decimal(account.warning_threshold):
        level = "warning"
    return {"level": level, **usage}

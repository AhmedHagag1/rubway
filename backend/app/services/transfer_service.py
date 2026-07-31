from datetime import (
    datetime,
    timedelta,
    timezone,
)
from decimal import (
    Decimal,
    ROUND_HALF_UP,
)
from uuid import uuid4

from fastapi import UploadFile
from sqlalchemy.orm import (
    Session,
    selectinload,
)

from app.models.quote import TransferQuote
from app.models.russian_recipient import (
    RussianRecipient,
)
from app.models.transfer import Transfer
from app.models.transfer_status import TransferStatus
from app.schemas.transfer import (
    RussianRecipientCreate,
    TransferCreate,
    TransferQuoteRequest,
)
from app.services.payment_account_service import choose_account
from app.services.exchange_rate_service import (
    get_exchange_rate,
)
from app.services.storage_service import (
    delete_receipt,
    save_receipt,
)
from app.services.telegram_service import (
    notify_receipt_uploaded,
    notify_transfer_created,
)


MIN_RUB_AMOUNT = Decimal("5000")
MAX_RUB_AMOUNT = Decimal("50000")

QUOTE_VALIDITY_MINUTES = 15

MONEY_PRECISION = Decimal("0.01")


def calculate_amounts(
    rub_amount: Decimal | None,
    egp_amount: Decimal | None,
    exchange_rate: Decimal,
) -> tuple[Decimal, Decimal]:
    if exchange_rate <= 0:
        raise ValueError(
            "Exchange rate must be greater than zero"
        )

    if egp_amount is not None:
        calculated_egp = egp_amount.quantize(
            MONEY_PRECISION,
            rounding=ROUND_HALF_UP,
        )

        calculated_rub = (
            calculated_egp
            * exchange_rate
        ).quantize(
            MONEY_PRECISION,
            rounding=ROUND_HALF_UP,
        )

    elif rub_amount is not None:
        calculated_rub = rub_amount.quantize(
            MONEY_PRECISION,
            rounding=ROUND_HALF_UP,
        )

        calculated_egp = (
            calculated_rub
            / exchange_rate
        ).quantize(
            MONEY_PRECISION,
            rounding=ROUND_HALF_UP,
        )

    else:
        raise ValueError(
            "Enter either rub_amount or egp_amount"
        )

    if calculated_rub < MIN_RUB_AMOUNT:
        raise ValueError(
            f"Minimum transfer amount is "
            f"{MIN_RUB_AMOUNT} RUB"
        )

    if calculated_rub > MAX_RUB_AMOUNT:
        raise ValueError(
            f"Maximum transfer amount is "
            f"{MAX_RUB_AMOUNT} RUB"
        )

    return (
        calculated_rub,
        calculated_egp,
    )


def create_quote(
    db: Session,
    quote_data: TransferQuoteRequest,
) -> dict:
    rate_result = get_exchange_rate(
    payment_method=quote_data.payment_method,
    db=db,
)

    rub_amount, egp_amount = calculate_amounts(
        rub_amount=quote_data.rub_amount,
        egp_amount=quote_data.egp_amount,
        exchange_rate=rate_result.customer_rate,
    )

    created_at = datetime.now(
        timezone.utc,
    )

    expires_at = created_at + timedelta(
        minutes=QUOTE_VALIDITY_MINUTES,
    )

    quote = TransferQuote(
        quote_id=str(uuid4()),
        rub_amount=rub_amount,
        egp_amount=egp_amount,
        exchange_rate=rate_result.customer_rate,
        payment_method=rate_result.payment_method,
        created_at=created_at,
        expires_at=expires_at,
        is_used=False,
    )

    try:
        db.add(quote)
        db.commit()
        db.refresh(quote)

    except Exception:
        db.rollback()
        raise

    return {
        "quote_id": quote.quote_id,
        "rub_amount": quote.rub_amount,
        "egp_amount": quote.egp_amount,
        "exchange_rate": quote.exchange_rate,
        "payment_method": quote.payment_method,
        "created_at": quote.created_at,
        "expires_at": quote.expires_at,
        "valid_for_seconds": (
            QUOTE_VALIDITY_MINUTES * 60
        ),
    }


async def create_transfer(
    db: Session,
    transfer_data: TransferCreate,
) -> Transfer:
    quote = (
        db.query(TransferQuote)
        .filter(
            TransferQuote.quote_id
            == transfer_data.quote_id
        )
        .with_for_update()
        .first()
    )

    if quote is None:
        raise ValueError(
            "Quote not found"
        )

    current_time = datetime.now(
        timezone.utc,
    )

    if quote.is_used:
        raise ValueError(
            "Quote has already been used"
        )

    quote_expires_at = quote.expires_at

    if quote_expires_at.tzinfo is None:
        quote_expires_at = (
            quote_expires_at.replace(
                tzinfo=timezone.utc,
            )
        )

    if quote_expires_at < current_time:
        raise ValueError(
            "Quote has expired"
        )

    existing_transfer = (
        db.query(Transfer)
        .filter(
            Transfer.quote_id
            == quote.quote_id
        )
        .first()
    )

    if existing_transfer is not None:
        raise ValueError(
            "A transfer already exists "
            "for this quote"
        )

    payment_account = choose_account(
        db=db,
        account_type=quote.payment_method,
        amount=Decimal(quote.egp_amount),
    )

    transfer = Transfer(
        payment_account_id=payment_account.id,
        quote_id=quote.quote_id,
        customer_name=(
            transfer_data.customer_name
        ),
        customer_phone=(
            transfer_data.customer_phone
        ),
        telegram_username=(
            transfer_data.telegram_username
        ),
        rub_amount=quote.rub_amount,
        egp_amount=quote.egp_amount,
        exchange_rate=quote.exchange_rate,
        payment_method=quote.payment_method,
        status=(
            TransferStatus
            .PENDING_PAYMENT
            .value
        ),
        receipt_path=None,
        rejection_reason=None,
        created_at=current_time,
        updated_at=current_time,
    )

    recipient_data = transfer_data.recipient
    recipient = RussianRecipient(
        recipient_name=recipient_data.recipient_name,
        recipient_phone=recipient_data.recipient_phone,
        bank_name=recipient_data.bank_name,
        card_number=recipient_data.card_number,
        account_number=recipient_data.account_number,
        sbp_phone=recipient_data.sbp_phone,
    )
    transfer.russian_recipient = recipient

    quote.is_used = True
    quote.used_at = current_time

    try:
        db.add(transfer)
        db.commit()
        db.refresh(transfer)
        transfer.payment_account = payment_account

    except Exception:
        db.rollback()
        raise

    await notify_transfer_created(
        transfer,
    )

    return transfer


def get_transfer(
    db: Session,
    transfer_id: int,
) -> Transfer | None:
    return (
        db.query(Transfer)
        .options(
            selectinload(
                Transfer.russian_recipient
            ),
            selectinload(
                Transfer.payment_account
            ),
        )
        .filter(
            Transfer.id == transfer_id
        )
        .first()
    )


async def upload_transfer_receipt(
    db: Session,
    transfer_id: int,
    receipt: UploadFile,
) -> Transfer:
    transfer = (
        db.query(Transfer)
        .filter(
            Transfer.id == transfer_id
        )
        .with_for_update()
        .first()
    )

    if transfer is None:
        raise ValueError(
            "Transfer not found"
        )

    if (
        transfer.status
        != TransferStatus.PENDING_PAYMENT.value
    ):
        raise ValueError(
            "A receipt can only be uploaded "
            "for a transfer awaiting payment"
        )

    if transfer.receipt_path:
        raise ValueError(
            "A receipt has already been uploaded "
            "for this transfer"
        )

    stored_receipt_path: str | None = None

    try:
        stored_receipt_path = await save_receipt(
            file=receipt,
            transfer_id=transfer.id,
        )

        transfer.receipt_path = (
            stored_receipt_path
        )

        transfer.status = (
            TransferStatus
            .PAYMENT_PROOF_UPLOADED
            .value
        )

        transfer.updated_at = datetime.now(
            timezone.utc,
        )

        db.commit()
        db.refresh(transfer)

    except Exception:
        db.rollback()

        if stored_receipt_path:
            delete_receipt(
                stored_receipt_path,
            )

        raise

    await notify_receipt_uploaded(
        transfer,
    )

    return transfer


def add_recipient_details(
    db: Session,
    transfer_id: int,
    recipient_data: RussianRecipientCreate,
) -> tuple[Transfer, RussianRecipient]:
    transfer = (
        db.query(Transfer)
        .options(
            selectinload(
                Transfer.russian_recipient
            ),
            selectinload(
                Transfer.payment_account
            ),
        )
        .filter(
            Transfer.id == transfer_id
        )
        .with_for_update()
        .first()
    )

    if transfer is None:
        raise ValueError(
            "Transfer not found"
        )

    if (
        transfer.status
        != TransferStatus.WAITING_RECIPIENT.value
    ):
        raise ValueError(
            "Recipient details can only be added "
            "after payment confirmation"
        )

    if transfer.russian_recipient is not None:
        raise ValueError(
            "Recipient details have already "
            "been added for this transfer"
        )

    current_time = datetime.now(
        timezone.utc,
    )

    recipient = RussianRecipient(
        transfer_id=transfer.id,
        recipient_name=(
            recipient_data.recipient_name
        ),
        recipient_phone=(
            recipient_data.recipient_phone
        ),
        bank_name=recipient_data.bank_name,
        card_number=recipient_data.card_number,
        account_number=(
            recipient_data.account_number
        ),
        sbp_phone=recipient_data.sbp_phone,
        created_at=current_time,
        updated_at=current_time,
    )

    transfer.status = (
        TransferStatus.READY_TO_SEND.value
    )

    transfer.updated_at = current_time

    try:
        db.add(recipient)
        db.commit()

        db.refresh(recipient)
        db.refresh(transfer)

    except Exception:
        db.rollback()
        raise

    return (
        transfer,
        recipient,
    )


def get_transfer_tracking(
    db: Session,
    transfer_id: int,
) -> dict:
    transfer = get_transfer(
        db=db,
        transfer_id=transfer_id,
    )

    if transfer is None:
        raise ValueError(
            "Transfer not found"
        )

    return {
        "transfer_id": transfer.id,
        "customer_phone": (
            transfer.customer_phone
        ),
        "rub_amount": transfer.rub_amount,
        "egp_amount": transfer.egp_amount,
        "payment_method": (
            transfer.payment_method
        ),
        "status": transfer.status,
        "has_receipt": bool(
            transfer.receipt_path
        ),
        "has_recipient_details": (
            transfer.russian_recipient
            is not None
        ),
        "rejection_reason": (
            transfer.rejection_reason
        ),
        "created_at": transfer.created_at,
        "updated_at": transfer.updated_at,
    }
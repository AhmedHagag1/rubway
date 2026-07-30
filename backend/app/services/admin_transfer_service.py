from datetime import datetime, timezone

from sqlalchemy.orm import (
    Session,
    selectinload,
)

from app.models.transfer import Transfer
from app.models.transfer_status import TransferStatus


ALLOWED_STATUSES = {
    status.value
    for status in TransferStatus
}


def list_transfers(
    db: Session,
    transfer_status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[Transfer], int]:
    if page < 1:
        raise ValueError(
            "Page must be greater than or equal to 1"
        )

    if page_size < 1 or page_size > 100:
        raise ValueError(
            "Page size must be between 1 and 100"
        )

    query = (
        db.query(Transfer)
        .options(
            selectinload(Transfer.russian_recipient),
            selectinload(Transfer.payment_account)
        )
    )

    if transfer_status is not None:
        normalized_status = (
            transfer_status
            .strip()
            .lower()
        )

        if normalized_status not in ALLOWED_STATUSES:
            raise ValueError(
                "Invalid transfer status"
            )

        query = query.filter(
            Transfer.status
            == normalized_status
        )

    total = query.count()

    transfers = (
        query
        .order_by(
            Transfer.created_at.desc()
        )
        .offset(
            (page - 1) * page_size
        )
        .limit(page_size)
        .all()
    )

    return transfers, total


def get_admin_transfer(
    db: Session,
    transfer_id: int,
) -> Transfer | None:
    return (
        db.query(Transfer)
        .options(
            selectinload(Transfer.russian_recipient),
            selectinload(Transfer.payment_account)
        )
        .filter(
            Transfer.id == transfer_id
        )
        .first()
    )


def _get_locked_transfer(
    db: Session,
    transfer_id: int,
) -> Transfer:
    transfer = (
        db.query(Transfer)
        .options(
            selectinload(Transfer.russian_recipient),
            selectinload(Transfer.payment_account)
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

    return transfer


def _save_status(
    db: Session,
    transfer: Transfer,
    new_status: TransferStatus,
) -> tuple[Transfer, str]:
    previous_status = transfer.status

    transfer.status = new_status.value
    transfer.updated_at = datetime.now(
        timezone.utc,
    )

    try:
        db.commit()
        db.refresh(transfer)

    except Exception:
        db.rollback()
        raise

    return (
        transfer,
        previous_status,
    )


def confirm_payment(
    db: Session,
    transfer_id: int,
) -> tuple[Transfer, str]:
    transfer = _get_locked_transfer(
        db=db,
        transfer_id=transfer_id,
    )

    if (
        transfer.status
        != TransferStatus
        .PAYMENT_PROOF_UPLOADED
        .value
    ):
        raise ValueError(
            "Only a transfer with an uploaded "
            "payment proof can be confirmed"
        )

    if not transfer.receipt_path:
        raise ValueError(
            "Transfer does not have "
            "a payment proof"
        )

    # Store the real Egyptian receipt timestamp once.
    # This keeps daily/monthly limits correct even if
    # the transfer status changes later.
    transfer.payment_confirmed_at = datetime.now(timezone.utc)

    next_status = (
        TransferStatus.READY_TO_SEND
        if transfer.russian_recipient is not None
        else TransferStatus.WAITING_RECIPIENT
    )

    return _save_status(
        db=db,
        transfer=transfer,
        new_status=next_status,
    )


def mark_rub_sent(
    db: Session,
    transfer_id: int,
) -> tuple[Transfer, str]:
    transfer = _get_locked_transfer(
        db=db,
        transfer_id=transfer_id,
    )

    if (
        transfer.status
        != TransferStatus.READY_TO_SEND.value
    ):
        raise ValueError(
            "Only a transfer ready to send "
            "can be marked as RUB sent"
        )

    if transfer.russian_recipient is None:
        raise ValueError(
            "Russian recipient details "
            "are missing"
        )

    return _save_status(
        db=db,
        transfer=transfer,
        new_status=TransferStatus.RUB_SENT,
    )


def complete_transfer(
    db: Session,
    transfer_id: int,
) -> tuple[Transfer, str]:
    transfer = _get_locked_transfer(
        db=db,
        transfer_id=transfer_id,
    )

    if (
        transfer.status
        != TransferStatus.RUB_SENT.value
    ):
        raise ValueError(
            "Only a transfer with RUB already sent "
            "can be completed"
        )

    return _save_status(
        db=db,
        transfer=transfer,
        new_status=TransferStatus.COMPLETED,
    )


def reject_transfer(
    db: Session,
    transfer_id: int,
    rejection_reason: str | None = None,
) -> tuple[Transfer, str]:
    transfer = _get_locked_transfer(
        db=db,
        transfer_id=transfer_id,
    )

    final_statuses = {
        TransferStatus.COMPLETED.value,
        TransferStatus.REJECTED.value,
    }

    if transfer.status in final_statuses:
        raise ValueError(
            "A completed or rejected transfer "
            "cannot be rejected"
        )

    normalized_reason: str | None = None

    if rejection_reason is not None:
        normalized_reason = (
            rejection_reason.strip()
        )

        if not normalized_reason:
            normalized_reason = None

    transfer.rejection_reason = (
        normalized_reason
        or "Transfer rejected by administrator"
    )

    return _save_status(
        db=db,
        transfer=transfer,
        new_status=TransferStatus.REJECTED,
    )
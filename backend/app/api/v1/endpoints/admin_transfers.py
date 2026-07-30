from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.security import require_admin
from app.database.database import get_db
from app.schemas.transfer import (
    AdminTransferListResponse,
    AdminTransferStatusUpdateResponse,
    TransferResponse,
)
from app.services.payment_account_service import evaluate_account_after_payment
from app.services.telegram_service import notify_payment_account_limit
from app.services.admin_transfer_service import (
    complete_transfer,
    confirm_payment,
    get_admin_transfer,
    list_transfers,
    mark_rub_sent,
    reject_transfer,
)


router = APIRouter(
    prefix="/admin/transfers",
    tags=["Admin Transfers"],
    dependencies=[
        Depends(require_admin),
    ],
)


@router.get(
    "",
    response_model=AdminTransferListResponse,
)
def list_admin_transfers_endpoint(
    transfer_status: Literal[
        "pending_payment",
        "payment_proof_uploaded",
        "payment_confirmed",
        "waiting_recipient",
        "ready_to_send",
        "rub_sent",
        "completed",
        "rejected",
    ]
    | None = Query(
        default=None,
        alias="status",
    ),
    page: int = Query(
        default=1,
        ge=1,
    ),
    page_size: int = Query(
        default=20,
        ge=1,
        le=100,
    ),
    db: Session = Depends(get_db),
):
    try:
        transfers, total = list_transfers(
            db=db,
            transfer_status=transfer_status,
            page=page,
            page_size=page_size,
        )

        return AdminTransferListResponse(
            items=transfers,
            total=total,
            page=page,
            page_size=page_size,
        )

    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail="Could not retrieve transfers",
        ) from error


@router.get(
    "/{transfer_id}",
    response_model=TransferResponse,
)
def get_admin_transfer_endpoint(
    transfer_id: int,
    db: Session = Depends(get_db),
):
    try:
        transfer = get_admin_transfer(
            db=db,
            transfer_id=transfer_id,
        )

        if transfer is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transfer not found",
            )

        return transfer

    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail="Could not retrieve the transfer",
        ) from error


@router.patch(
    "/{transfer_id}/confirm-payment",
    response_model=AdminTransferStatusUpdateResponse,
)
async def confirm_payment_endpoint(
    transfer_id: int,
    db: Session = Depends(get_db),
):
    try:
        transfer, previous_status = confirm_payment(
            db=db,
            transfer_id=transfer_id,
        )

        if transfer.payment_account is not None:
            usage = evaluate_account_after_payment(db, transfer.payment_account)
            await notify_payment_account_limit(transfer.payment_account, usage)

        return AdminTransferStatusUpdateResponse(
            transfer_id=transfer.id,
            previous_status=previous_status,
            current_status=transfer.status,
            message=(
                "Payment confirmed successfully. "
                "Waiting for recipient details."
            ),
        )

    except ValueError as error:
        if str(error) == "Transfer not found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(error),
            ) from error

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail="Could not confirm the payment",
        ) from error


@router.patch(
    "/{transfer_id}/mark-rub-sent",
    response_model=AdminTransferStatusUpdateResponse,
)
def mark_rub_sent_endpoint(
    transfer_id: int,
    db: Session = Depends(get_db),
):
    try:
        transfer, previous_status = mark_rub_sent(
            db=db,
            transfer_id=transfer_id,
        )

        return AdminTransferStatusUpdateResponse(
            transfer_id=transfer.id,
            previous_status=previous_status,
            current_status=transfer.status,
            message="RUB marked as sent successfully",
        )

    except ValueError as error:
        if str(error) == "Transfer not found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(error),
            ) from error

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail="Could not mark RUB as sent",
        ) from error


@router.patch(
    "/{transfer_id}/complete",
    response_model=AdminTransferStatusUpdateResponse,
)
def complete_transfer_endpoint(
    transfer_id: int,
    db: Session = Depends(get_db),
):
    try:
        transfer, previous_status = complete_transfer(
            db=db,
            transfer_id=transfer_id,
        )

        return AdminTransferStatusUpdateResponse(
            transfer_id=transfer.id,
            previous_status=previous_status,
            current_status=transfer.status,
            message="Transfer completed successfully",
        )

    except ValueError as error:
        if str(error) == "Transfer not found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(error),
            ) from error

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail="Could not complete the transfer",
        ) from error


@router.patch(
    "/{transfer_id}/reject",
    response_model=AdminTransferStatusUpdateResponse,
)
def reject_transfer_endpoint(
    transfer_id: int,
    rejection_reason: str | None = Query(
        default=None,
        min_length=3,
        max_length=500,
    ),
    db: Session = Depends(get_db),
):
    try:
        transfer, previous_status = reject_transfer(
            db=db,
            transfer_id=transfer_id,
            rejection_reason=rejection_reason,
        )

        return AdminTransferStatusUpdateResponse(
            transfer_id=transfer.id,
            previous_status=previous_status,
            current_status=transfer.status,
            message="Transfer rejected successfully",
        )

    except ValueError as error:
        if str(error) == "Transfer not found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(error),
            ) from error

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    except SQLAlchemyError as error:
        raise HTTPException(
            status_code=(
                status.HTTP_500_INTERNAL_SERVER_ERROR
            ),
            detail="Could not reject the transfer",
        ) from error
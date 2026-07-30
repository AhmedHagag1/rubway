from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.transfer import (
    ReceiptUploadResponse,
    RecipientDetailsResponse,
    RussianRecipientCreate,
    TransferCreate,
    TransferQuoteRequest,
    TransferQuoteResponse,
    TransferResponse,
    TransferTrackingResponse,
)
from app.services.transfer_service import (
    add_recipient_details,
    create_quote,
    create_transfer,
    get_transfer,
    get_transfer_tracking,
    upload_transfer_receipt,
)


router = APIRouter(
    prefix="/transfers",
    tags=["Transfers"],
)


@router.post(
    "/quote",
    response_model=TransferQuoteResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_transfer_quote_endpoint(
    quote_data: TransferQuoteRequest,
    db: Session = Depends(get_db),
):
    try:
        return create_quote(
            db=db,
            quote_data=quote_data,
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
            detail="Could not create the quote",
        ) from error


@router.post(
    "",
    response_model=TransferResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_transfer_endpoint(
    transfer_data: TransferCreate,
    db: Session = Depends(get_db),
):
    try:
        return await create_transfer(
            db=db,
            transfer_data=transfer_data,
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
            detail="Could not create the transfer",
        ) from error


@router.get(
    "/track/{transfer_id}",
    response_model=TransferTrackingResponse,
)
def track_transfer_endpoint(
    transfer_id: int,
    db: Session = Depends(get_db),
):
    try:
        return get_transfer_tracking(
            db=db,
            transfer_id=transfer_id,
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
            detail="Could not retrieve transfer tracking",
        ) from error


@router.get(
    "/{transfer_id}",
    response_model=TransferResponse,
)
def get_transfer_endpoint(
    transfer_id: int,
    db: Session = Depends(get_db),
):
    transfer = get_transfer(
        db=db,
        transfer_id=transfer_id,
    )

    if transfer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transfer not found",
        )

    return transfer


@router.post(
    "/{transfer_id}/receipt",
    response_model=ReceiptUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_receipt_endpoint(
    transfer_id: int,
    receipt: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    try:
        transfer = await upload_transfer_receipt(
            db=db,
            transfer_id=transfer_id,
            receipt=receipt,
        )

        if not transfer.receipt_path:
            raise HTTPException(
                status_code=(
                    status.HTTP_500_INTERNAL_SERVER_ERROR
                ),
                detail="Receipt path was not saved",
            )

        return ReceiptUploadResponse(
            transfer_id=transfer.id,
            status=transfer.status,
            receipt_path=transfer.receipt_path,
            message="Receipt uploaded successfully",
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
            detail="Could not save the receipt",
        ) from error


@router.post(
    "/{transfer_id}/recipient-details",
    response_model=RecipientDetailsResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_recipient_details_endpoint(
    transfer_id: int,
    recipient_data: RussianRecipientCreate,
    db: Session = Depends(get_db),
):
    try:
        transfer, recipient = add_recipient_details(
            db=db,
            transfer_id=transfer_id,
            recipient_data=recipient_data,
        )

        return RecipientDetailsResponse(
            transfer_id=transfer.id,
            status=transfer.status,
            recipient=recipient,
            message=(
                "Recipient details added successfully"
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
            detail="Could not save recipient details",
        ) from error
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import require_admin
from app.database.database import get_db
from app.schemas.payment_account import PaymentAccountCreate, PaymentAccountUpdate, PaymentAccountUsageResponse
from app.services.payment_account_service import create_account, list_accounts, update_account

router = APIRouter(prefix="/admin/payment-accounts", tags=["Payment Accounts"], dependencies=[Depends(require_admin)])


@router.get("", response_model=list[PaymentAccountUsageResponse])
def list_payment_accounts(db: Session = Depends(get_db)):
    return list_accounts(db)


@router.post("", response_model=PaymentAccountUsageResponse, status_code=status.HTTP_201_CREATED)
def create_payment_account(payload: PaymentAccountCreate, db: Session = Depends(get_db)):
    account = create_account(db, payload)
    return next(item for item in list_accounts(db) if item["id"] == account.id)


@router.patch("/{account_id}", response_model=PaymentAccountUsageResponse)
def patch_payment_account(account_id: int, payload: PaymentAccountUpdate, db: Session = Depends(get_db)):
    try:
        account = update_account(db, account_id, payload)
        return next(item for item in list_accounts(db) if item["id"] == account.id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

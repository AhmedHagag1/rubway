from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import require_admin
from app.database.database import get_db
from app.schemas.pricing import PricingResponse, PricingUpdate
from app.services.pricing_service import get_or_create_pricing, update_pricing

router = APIRouter(
    prefix="/admin/pricing",
    tags=["Pricing"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=PricingResponse)
def get_pricing(db: Session = Depends(get_db)):
    return get_or_create_pricing(db)


@router.put("", response_model=PricingResponse)
def put_pricing(payload: PricingUpdate, db: Session = Depends(get_db)):
    return update_pricing(db, payload)

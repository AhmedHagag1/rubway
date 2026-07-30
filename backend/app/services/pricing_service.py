from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.pricing_setting import PricingSetting
from app.schemas.pricing import PricingUpdate

DEFAULT_INSTAPAY_RATE = Decimal("1.6500")
DEFAULT_VODAFONE_RATE = Decimal("1.6300")


def get_or_create_pricing(db: Session) -> PricingSetting:
    setting = db.query(PricingSetting).order_by(PricingSetting.id.asc()).first()
    if setting is not None:
        return setting

    setting = PricingSetting(
        instapay_rate=DEFAULT_INSTAPAY_RATE,
        vodafone_rate=DEFAULT_VODAFONE_RATE,
    )
    db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting


def update_pricing(db: Session, payload: PricingUpdate) -> PricingSetting:
    setting = get_or_create_pricing(db)
    setting.instapay_rate = payload.instapay_rate
    setting.vodafone_rate = payload.vodafone_rate
    setting.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(setting)
    return setting

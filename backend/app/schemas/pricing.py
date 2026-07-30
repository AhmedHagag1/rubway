from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PricingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    instapay_rate: Decimal
    vodafone_rate: Decimal
    updated_at: datetime


class PricingUpdate(BaseModel):
    instapay_rate: Decimal = Field(gt=0, max_digits=10, decimal_places=4)
    vodafone_rate: Decimal = Field(gt=0, max_digits=10, decimal_places=4)

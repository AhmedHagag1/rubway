from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

AccountType = Literal["vodafone", "instapay"]


class PaymentAccountBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    account_type: AccountType
    account_number: str = Field(min_length=5, max_length=80)
    account_holder_name: str = Field(min_length=2, max_length=150)
    daily_limit: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    monthly_limit: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    warning_threshold: Decimal = Field(default=80, ge=1, le=99)
    critical_threshold: Decimal = Field(default=90, ge=1, le=100)
    is_active: bool = True
    priority: int = Field(default=100, ge=1, le=10000)

    @field_validator("name", "account_number", "account_holder_name", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip() if isinstance(value, str) else value


class PaymentAccountCreate(PaymentAccountBase):
    pass


class PaymentAccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    account_number: str | None = Field(default=None, min_length=5, max_length=80)
    account_holder_name: str | None = Field(default=None, min_length=2, max_length=150)
    daily_limit: Decimal | None = Field(default=None, gt=0)
    monthly_limit: Decimal | None = Field(default=None, gt=0)
    warning_threshold: Decimal | None = Field(default=None, ge=1, le=99)
    critical_threshold: Decimal | None = Field(default=None, ge=1, le=100)
    is_active: bool | None = None
    priority: int | None = Field(default=None, ge=1, le=10000)


class PaymentAccountResponse(PaymentAccountBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    updated_at: datetime


class PaymentAccountUsageResponse(PaymentAccountResponse):
    used_today: Decimal
    remaining_today: Decimal
    used_this_month: Decimal
    remaining_this_month: Decimal
    daily_usage_percent: Decimal
    monthly_usage_percent: Decimal
    masked_account_number: str

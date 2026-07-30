from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


PaymentMethod = Literal[
    "vodafone",
    "instapay",
]

TransferStatus = Literal[
    "pending_payment",
    "payment_proof_uploaded",
    "payment_confirmed",
    "waiting_recipient",
    "ready_to_send",
    "rub_sent",
    "completed",
    "rejected",
]


class TransferQuoteRequest(BaseModel):
    rub_amount: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=12,
        decimal_places=2,
        examples=[16363.00],
    )

    egp_amount: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=12,
        decimal_places=2,
        examples=[10000.00],
    )

    payment_method: PaymentMethod = Field(
        examples=["instapay"],
    )

    @model_validator(mode="after")
    def validate_amounts(
        self,
    ) -> "TransferQuoteRequest":
        has_rub_amount = self.rub_amount is not None
        has_egp_amount = self.egp_amount is not None

        if has_rub_amount == has_egp_amount:
            raise ValueError(
                "Enter exactly one amount: "
                "rub_amount or egp_amount"
            )

        return self


class TransferQuoteResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    quote_id: str

    rub_amount: Decimal = Field(
        max_digits=12,
        decimal_places=2,
        examples=[16363.00],
    )

    egp_amount: Decimal = Field(
        max_digits=12,
        decimal_places=2,
        examples=[10000.00],
    )

    exchange_rate: Decimal = Field(
        max_digits=10,
        decimal_places=4,
        examples=[1.6363],
    )

    payment_method: PaymentMethod
    created_at: datetime
    expires_at: datetime
    valid_for_seconds: int


class TransferCreate(BaseModel):
    quote_id: str = Field(
        min_length=36,
        max_length=36,
    )

    customer_name: str = Field(
        min_length=2,
        max_length=120,
        examples=["Ahmed Haggag"],
    )

    customer_phone: str = Field(
        min_length=7,
        max_length=30,
        examples=["201001234567"],
    )

    telegram_username: str | None = Field(
        default=None,
        max_length=64,
        examples=["@haggag_ru"],
    )

    recipient: RussianRecipientCreate

    @field_validator(
        "customer_name",
        "customer_phone",
        mode="before",
    )
    @classmethod
    def strip_required_fields(
        cls,
        value: str,
    ) -> str:
        if not isinstance(value, str):
            return value

        return value.strip()

    @field_validator(
        "telegram_username",
        mode="before",
    )
    @classmethod
    def normalize_telegram_username(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.strip()

        if not normalized:
            return None

        if normalized.startswith("@"):
            normalized = normalized[1:]

        return normalized

    @field_validator("customer_phone")
    @classmethod
    def validate_customer_phone(
        cls,
        value: str,
    ) -> str:
        allowed_characters = set(
            "0123456789+ -()"
        )

        if any(
            character not in allowed_characters
            for character in value
        ):
            raise ValueError(
                "Phone number contains invalid characters"
            )

        digits = "".join(
            character
            for character in value
            if character.isdigit()
        )

        if len(digits) < 7:
            raise ValueError(
                "Phone number is too short"
            )

        return value


class RussianRecipientCreate(BaseModel):
    recipient_name: str = Field(
        min_length=2,
        max_length=150,
        examples=["Ivan Ivanov"],
    )

    recipient_phone: str = Field(
        min_length=7,
        max_length=30,
        examples=["+79991234567"],
    )

    bank_name: str = Field(
        min_length=2,
        max_length=100,
        examples=["Sberbank"],
    )

    card_number: str | None = Field(
        default=None,
        max_length=30,
        examples=["2202200012345678"],
    )

    account_number: str | None = Field(
        default=None,
        max_length=50,
    )

    sbp_phone: str | None = Field(
        default=None,
        max_length=30,
        examples=["+79991234567"],
    )

    @field_validator(
        "recipient_name",
        "recipient_phone",
        "bank_name",
        mode="before",
    )
    @classmethod
    def strip_required_fields(
        cls,
        value: str,
    ) -> str:
        if not isinstance(value, str):
            return value

        return value.strip()

    @field_validator(
        "card_number",
        "account_number",
        "sbp_phone",
        mode="before",
    )
    @classmethod
    def normalize_optional_fields(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.strip()

        if not normalized:
            return None

        return normalized

    @field_validator(
        "recipient_phone",
        "sbp_phone",
    )
    @classmethod
    def validate_phone(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        allowed_characters = set(
            "0123456789+ -()"
        )

        if any(
            character not in allowed_characters
            for character in value
        ):
            raise ValueError(
                "Phone number contains invalid characters"
            )

        digits = "".join(
            character
            for character in value
            if character.isdigit()
        )

        if len(digits) < 7:
            raise ValueError(
                "Phone number is too short"
            )

        return value

    @field_validator("card_number")
    @classmethod
    def normalize_card_number(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.replace(
            " ",
            "",
        ).replace(
            "-",
            "",
        )

        if not normalized.isdigit():
            raise ValueError(
                "Card number must contain digits only"
            )

        if not 12 <= len(normalized) <= 19:
            raise ValueError(
                "Card number must contain "
                "between 12 and 19 digits"
            )

        return normalized

    @field_validator("account_number")
    @classmethod
    def normalize_account_number(
        cls,
        value: str | None,
    ) -> str | None:
        if value is None:
            return None

        normalized = value.replace(
            " ",
            "",
        ).replace(
            "-",
            "",
        )

        if not normalized.isdigit():
            raise ValueError(
                "Account number must contain digits only"
            )

        return normalized

    @model_validator(mode="after")
    def validate_payment_details(
        self,
    ) -> "RussianRecipientCreate":
        has_payment_details = any(
            [
                self.card_number,
                self.account_number,
                self.sbp_phone,
            ]
        )

        if not has_payment_details:
            raise ValueError(
                "Provide at least one recipient payment "
                "detail: card_number, account_number "
                "or sbp_phone"
            )

        return self


class RussianRecipientResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    transfer_id: int

    recipient_name: str
    recipient_phone: str
    bank_name: str

    card_number: str | None = None
    account_number: str | None = None
    sbp_phone: str | None = None

    created_at: datetime
    updated_at: datetime


class PaymentAccountSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    account_type: str
    account_number: str
    account_holder_name: str


class TransferResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: int
    quote_id: str | None = None
    payment_account_id: int | None = None

    customer_name: str | None = None
    customer_phone: str | None = None
    telegram_username: str | None = None

    rub_amount: Decimal = Field(
        max_digits=12,
        decimal_places=2,
    )

    egp_amount: Decimal = Field(
        max_digits=12,
        decimal_places=2,
    )

    exchange_rate: Decimal = Field(
        max_digits=10,
        decimal_places=4,
    )

    payment_method: PaymentMethod
    status: TransferStatus

    payment_confirmed_at: datetime | None = None
    receipt_path: str | None = None
    rejection_reason: str | None = None

    russian_recipient: RussianRecipientResponse | None = None
    payment_account: PaymentAccountSummary | None = None

    created_at: datetime
    updated_at: datetime | None = None


class RecipientDetailsResponse(BaseModel):
    transfer_id: int
    status: TransferStatus
    recipient: RussianRecipientResponse
    message: str


class TransferTrackingResponse(BaseModel):
    transfer_id: int
    customer_phone: str | None = None

    rub_amount: Decimal = Field(
        max_digits=12,
        decimal_places=2,
    )

    egp_amount: Decimal = Field(
        max_digits=12,
        decimal_places=2,
    )

    payment_method: PaymentMethod
    status: TransferStatus

    has_receipt: bool
    has_recipient_details: bool

    rejection_reason: str | None = None
    created_at: datetime
    updated_at: datetime | None = None


class ReceiptUploadResponse(BaseModel):
    transfer_id: int
    status: TransferStatus
    receipt_path: str
    message: str


class AdminTransferStatusUpdateResponse(BaseModel):
    transfer_id: int
    previous_status: TransferStatus
    current_status: TransferStatus
    message: str


class AdminTransferListResponse(BaseModel):
    items: list[TransferResponse]
    total: int
    page: int
    page_size: int
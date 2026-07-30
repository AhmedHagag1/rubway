from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.database.database import Base
from app.models.transfer_status import TransferStatus


class Transfer(Base):
    __tablename__ = "transfers"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    payment_account_id: Mapped[int | None] = mapped_column(
        ForeignKey("payment_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    quote_id: Mapped[str | None] = mapped_column(
        String(36),
        unique=True,
        nullable=True,
        index=True,
    )

    customer_name: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    customer_phone: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
        index=True,
    )

    telegram_username: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        index=True,
    )

    rub_amount: Mapped[float] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    egp_amount: Mapped[float] = mapped_column(
        Numeric(12, 2),
        nullable=False,
    )

    exchange_rate: Mapped[float] = mapped_column(
        Numeric(10, 4),
        nullable=False,
    )

    payment_method: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default=TransferStatus.PENDING_PAYMENT.value,
        index=True,
    )

    payment_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    receipt_path: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    rejection_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    payment_account = relationship(
        "PaymentAccount",
        back_populates="transfers",
    )

    russian_recipient = relationship(
        "RussianRecipient",
        back_populates="transfer",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
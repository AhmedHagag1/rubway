from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
    relationship,
)

from app.database.database import Base


class RussianRecipient(Base):
    __tablename__ = "russian_recipients"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True,
    )

    transfer_id: Mapped[int] = mapped_column(
        ForeignKey(
            "transfers.id",
            ondelete="CASCADE",
        ),
        unique=True,
        nullable=False,
        index=True,
    )

    recipient_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    recipient_phone: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        index=True,
    )

    bank_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    card_number: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
    )

    account_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )

    sbp_phone: Mapped[str | None] = mapped_column(
        String(30),
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

    transfer = relationship(
        "Transfer",
        back_populates="russian_recipient",
    )
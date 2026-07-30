from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.database import Base


class PaymentAccount(Base):
    __tablename__ = "payment_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    account_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    account_number: Mapped[str] = mapped_column(String(80), nullable=False)
    account_holder_name: Mapped[str] = mapped_column(String(150), nullable=False)
    daily_limit: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    monthly_limit: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    warning_threshold: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=80)
    critical_threshold: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False, default=90)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=100, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    transfers = relationship("Transfer", back_populates="payment_account")

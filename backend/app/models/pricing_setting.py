from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.database.database import Base


class PricingSetting(Base):
    __tablename__ = "pricing_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    instapay_rate: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)
    vodafone_rate: Mapped[float] = mapped_column(Numeric(10, 4), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

import httpx
from dotenv import load_dotenv


load_dotenv()

logger = logging.getLogger(__name__)

RATE_PRECISION = Decimal("0.0001")

EXCHANGE_RATE_API_URL = os.getenv(
    "EXCHANGE_RATE_API_URL",
    "https://v6.exchangerate-api.com/v6",
).rstrip("/")

RATE_CACHE_SECONDS = int(
    os.getenv("RATE_CACHE_SECONDS", "300")
)

PAYMENT_METHOD_MARKUPS = {
    "vodafone": Decimal(
        os.getenv("VODAFONE_MARKUP", "0.09")
    ),
    "instapay": Decimal(
        os.getenv("INSTAPAY_MARKUP", "0.11")
    ),
}


@dataclass(frozen=True)
class ExchangeRateResult:
    market_rate: Decimal
    customer_rate: Decimal
    payment_method: str
    source: str
    updated_at: datetime


_cached_market_rate: Decimal | None = None
_cached_updated_at: datetime | None = None
_cache_expires_at: float = 0.0


def normalize_payment_method(
    payment_method: str,
) -> str:
    normalized_method = payment_method.lower().strip()

    if normalized_method not in PAYMENT_METHOD_MARKUPS:
        raise ValueError(
            "Payment method must be "
            "'vodafone' or 'instapay'"
        )

    return normalized_method


def parse_unix_timestamp(
    timestamp: int | float | None,
) -> datetime:
    if timestamp is None:
        return datetime.now(timezone.utc)

    try:
        return datetime.fromtimestamp(
            timestamp,
            tz=timezone.utc,
        )
    except (TypeError, ValueError, OSError):
        return datetime.now(timezone.utc)


def fetch_market_rate() -> tuple[Decimal, datetime]:
    api_key = os.getenv("EXCHANGE_RATE_API_KEY")

    if not api_key:
        raise ValueError(
            "EXCHANGE_RATE_API_KEY is missing "
            "from the .env file"
        )

    request_url = (
        f"{EXCHANGE_RATE_API_URL}/"
        f"{api_key}/latest/EGP"
    )

    last_error: Exception | None = None

    for attempt in range(1, 4):
        try:
            with httpx.Client(
                timeout=httpx.Timeout(10.0),
            ) as client:
                response = client.get(
                    request_url,
                    headers={
                        "accept": "application/json",
                    },
                )

            response.raise_for_status()
            response_data = response.json()

            if response_data.get("result") != "success":
                error_type = response_data.get(
                    "error-type",
                    "unknown-error",
                )

                raise ValueError(
                    f"Exchange-rate provider error: "
                    f"{error_type}"
                )

            raw_rate = response_data[
                "conversion_rates"
            ]["RUB"]

            market_rate = Decimal(
                str(raw_rate)
            ).quantize(
                RATE_PRECISION,
                rounding=ROUND_HALF_UP,
            )

            if market_rate <= 0:
                raise ValueError(
                    "Exchange-rate provider returned "
                    "an invalid rate"
                )

            updated_at = parse_unix_timestamp(
                response_data.get(
                    "time_last_update_unix"
                )
            )

            logger.info(
                "Fetched EGP/RUB rate: %s",
                market_rate,
            )

            return market_rate, updated_at

        except (
            httpx.TimeoutException,
            httpx.RequestError,
            httpx.HTTPStatusError,
            KeyError,
            TypeError,
            InvalidOperation,
            ValueError,
        ) as error:
            last_error = error

            logger.warning(
                "Exchange-rate request failed. "
                "Attempt %s of 3: %s",
                attempt,
                error,
            )

            if attempt < 3:
                time.sleep(1)

    raise ValueError(
        "Could not retrieve the exchange rate"
    ) from last_error


def get_market_rate() -> tuple[Decimal, datetime]:
    global _cached_market_rate
    global _cached_updated_at
    global _cache_expires_at

    current_time = time.monotonic()

    if (
        _cached_market_rate is not None
        and _cached_updated_at is not None
        and current_time < _cache_expires_at
    ):
        return (
            _cached_market_rate,
            _cached_updated_at,
        )

    market_rate, updated_at = fetch_market_rate()

    _cached_market_rate = market_rate
    _cached_updated_at = updated_at
    _cache_expires_at = (
        current_time + RATE_CACHE_SECONDS
    )

    return market_rate, updated_at


def get_exchange_rate(
    payment_method: str,
    db,
) -> ExchangeRateResult:
    from app.services.pricing_service import get_or_create_pricing

    normalized_method = normalize_payment_method(payment_method)
    setting = get_or_create_pricing(db)

    customer_rate = Decimal(str(
        setting.instapay_rate
        if normalized_method == "instapay"
        else setting.vodafone_rate
    )).quantize(RATE_PRECISION, rounding=ROUND_HALF_UP)

    return ExchangeRateResult(
        market_rate=customer_rate,
        customer_rate=customer_rate,
        payment_method=normalized_method,
        source="manual-admin",
        updated_at=setting.updated_at,
    )

from fastapi import APIRouter

from app.api.v1.endpoints.admin_transfers import (
    router as admin_transfers_router,
)
from app.api.v1.endpoints.auth import (
    router as auth_router,
)
from app.api.v1.endpoints.payment_accounts import (
    router as payment_accounts_router,
)
from app.api.v1.endpoints.transfers import (
    router as transfers_router,
)
from app.api.v1.endpoints.telegram_bot import (
    router as telegram_bot_router,
)


api_router = APIRouter()

api_router.include_router(auth_router)
api_router.include_router(transfers_router)
api_router.include_router(admin_transfers_router)
api_router.include_router(payment_accounts_router)
api_router.include_router(telegram_bot_router)

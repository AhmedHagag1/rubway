import os

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)
from fastapi.security import OAuth2PasswordRequestForm

from app.core.security import (
    authenticate_admin,
    create_access_token,
    require_admin,
)
from app.schemas.auth import (
    AdminProfileResponse,
    TokenResponse,
)


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/login",
    response_model=TokenResponse,
)
def login_admin_endpoint(
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    is_authenticated = authenticate_admin(
        username=form_data.username,
        password=form_data.password,
    )

    if not is_authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    access_token, expires_in = create_access_token(
        subject=form_data.username,
        role="admin",
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=expires_in,
    )


@router.get(
    "/me",
    response_model=AdminProfileResponse,
)
def get_admin_profile_endpoint(
    token_payload: dict = Depends(require_admin),
):
    return AdminProfileResponse(
        username=token_payload["sub"],
        role=token_payload["role"],
    )
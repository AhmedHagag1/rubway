import os
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash


load_dotenv()

password_hash = PasswordHash.recommended()

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login"
)


def get_required_setting(name: str) -> str:
    value = os.getenv(name)

    if not value:
        raise RuntimeError(
            f"{name} is missing from the .env file"
        )

    return value


def verify_password(
    plain_password: str,
    stored_password_hash: str,
) -> bool:
    try:
        return password_hash.verify(
            plain_password,
            stored_password_hash,
        )
    except Exception:
        return False


def authenticate_admin(
    username: str,
    password: str,
) -> bool:
    admin_username = get_required_setting(
        "ADMIN_USERNAME"
    )

    admin_password_hash = get_required_setting(
        "ADMIN_PASSWORD_HASH"
    )

    if username != admin_username:
        return False

    return verify_password(
        plain_password=password,
        stored_password_hash=admin_password_hash,
    )


def create_access_token(
    subject: str,
    role: str,
) -> tuple[str, int]:
    secret_key = get_required_setting(
        "JWT_SECRET_KEY"
    )

    algorithm = os.getenv(
        "JWT_ALGORITHM",
        "HS256",
    )

    expire_minutes = int(
        os.getenv(
            "JWT_ACCESS_TOKEN_EXPIRE_MINUTES",
            "60",
        )
    )

    expires_at = datetime.now(
        timezone.utc
    ) + timedelta(minutes=expire_minutes)

    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "iat": datetime.now(timezone.utc),
        "exp": expires_at,
    }

    token = jwt.encode(
        payload,
        secret_key,
        algorithm=algorithm,
    )

    return token, expire_minutes * 60


def decode_access_token(
    token: str,
) -> dict[str, Any]:
    secret_key = get_required_setting(
        "JWT_SECRET_KEY"
    )

    algorithm = os.getenv(
        "JWT_ALGORITHM",
        "HS256",
    )

    try:
        payload = jwt.decode(
            token,
            secret_key,
            algorithms=[algorithm],
        )

    except InvalidTokenError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        ) from error

    subject = payload.get("sub")
    role = payload.get("role")

    if not subject or not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token payload",
            headers={
                "WWW-Authenticate": "Bearer",
            },
        )

    return payload


def require_admin(
    token: str = Depends(oauth2_scheme),
) -> dict[str, Any]:
    payload = decode_access_token(token)

    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access is required",
        )

    return payload
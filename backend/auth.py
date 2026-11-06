import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash

import db


load_dotenv()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60")
)

password_hash = PasswordHash.recommended()

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login"
)


# --------------------------------------------------
# Configuration Validation
# --------------------------------------------------

def validate_auth_config() -> None:
    if not JWT_SECRET_KEY or len(JWT_SECRET_KEY) < 32:
        raise RuntimeError(
            "JWT_SECRET_KEY is missing or too short. "
            "Generate a strong random secret in .env."
        )


# --------------------------------------------------
# Password Hashing
# --------------------------------------------------

def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(
    password: str,
    stored_hash: str,
) -> bool:
    return password_hash.verify(password, stored_hash)


# --------------------------------------------------
# JWT Creation
# --------------------------------------------------

def create_access_token(user_id: UUID) -> str:

    now = datetime.now(timezone.utc)

    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        ),
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


# --------------------------------------------------
# JWT Validation
# --------------------------------------------------

async def get_current_user(
    token: str = Depends(oauth2_scheme),
) -> dict:

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired authentication token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )

        subject = payload.get("sub")

        if not subject:
            raise credentials_exception

        user_id = UUID(subject)

    except (
        jwt.InvalidTokenError,
        ValueError,
        TypeError,
    ) as exc:
        raise credentials_exception from exc

    user = await db.get_user_by_id(user_id)

    if user is None:
        raise credentials_exception

    return user
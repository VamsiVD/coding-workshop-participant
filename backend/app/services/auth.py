"""Registration and sign-in rules."""

import logging

from psycopg import Connection

from app.core.config import get_settings
from app.core.errors import AuthenticationError, ConflictError
from app.core.security import create_access_token, hash_password, verify_password
from app.repositories import users as users_repo
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut

logger = logging.getLogger(__name__)

# One message for every sign-in failure. Distinguishing "no such account" from
# "wrong password" would let anyone enumerate who is registered.
_SIGN_IN_FAILED = "The email address or password is incorrect."

# A real bcrypt hash of a value nothing will match, used only so that a failed
# lookup costs the same time as a failed password check.
_TIMING_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.7Zt0VxQXqFXJZmqJ0lQZ3mI9Rt8BCXu"


def register(conn: Connection, payload: RegisterRequest) -> UserOut:
    """Self-registration always produces an employee.

    The role is not read from the request. Administrator and engineer accounts
    are created by an administrator; accepting a role here would let anyone
    register themselves as one.
    """
    if users_repo.exists_by_email(conn, payload.email):
        raise ConflictError("An account with this email address already exists.")

    user = users_repo.create(
        conn,
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role="employee",
    )
    logger.info("user registered id=%s", user["id"])
    return UserOut(**user)


def login(conn: Connection, payload: LoginRequest) -> TokenResponse:
    settings = get_settings()
    user = users_repo.get_by_email_with_hash(conn, payload.email)

    if user is None:
        # Hash anyway, so response time does not reveal whether the address
        # exists.
        verify_password(payload.password, _TIMING_HASH)
        logger.info("sign-in failed: unknown address")
        raise AuthenticationError(_SIGN_IN_FAILED)

    if not verify_password(payload.password, user["password_hash"]):
        logger.info("sign-in failed: bad password user_id=%s", user["id"])
        raise AuthenticationError(_SIGN_IN_FAILED)

    if not user["is_active"]:
        logger.info("sign-in failed: inactive user_id=%s", user["id"])
        raise AuthenticationError("This account has been deactivated.")

    token = create_access_token(
        user_id=user["id"], role=user["role"], email=user["email"]
    )
    public = {k: v for k, v in user.items() if k != "password_hash"}
    logger.info("sign-in ok user_id=%s role=%s", user["id"], user["role"])
    return TokenResponse(
        access_token=token,
        expires_in=settings.access_token_ttl_minutes * 60,
        user=UserOut(**public),
    )

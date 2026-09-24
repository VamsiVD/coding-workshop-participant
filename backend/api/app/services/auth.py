"""Registration and sign-in rules.

Sits between the auth routes and the users repository: it hashes passwords,
checks credentials and issues access tokens.
"""

import logging

from psycopg import Connection

from app.core.config import get_settings
from app.core.errors import AuthenticationError, ConflictError, ValidationError
from app.core.security import create_access_token, hash_password, verify_password
from app.repositories import facilities as facilities_repo
from app.repositories import users as users_repo
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut

logger = logging.getLogger(__name__)

# One message for every sign-in failure. Distinguishing "no such account" from
# "wrong password" would let anyone enumerate who is registered.
_SIGN_IN_FAILED = "The email address or password is incorrect."

# A real bcrypt hash of a value nothing will match, used only so that a failed
# lookup costs the same time as a failed password check.
_TIMING_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.7Zt0VxQXqFXJZmqJ0lQZ3mI9Rt8BCXu"


def _check_location(conn: Connection, payload: RegisterRequest) -> None:
    """Refuse a workplace that does not exist or does not hang together.

    The composite foreign keys would refuse it too, but as a bare 409; this
    names the field so the form can show the message beside it.
    """
    if payload.building_id is not None:
        building = facilities_repo.get_building(conn, payload.building_id)
        if building is None or not building["is_active"]:
            message = "Choose a building from the list."
            raise ValidationError(message, {"building_id": message})
    if payload.floor_id is not None:
        floor = facilities_repo.get_floor(conn, payload.floor_id)
        if floor is None or floor["building_id"] != payload.building_id:
            message = "That floor is not in the chosen building."
            raise ValidationError(message, {"floor_id": message})
    if payload.seat_id is not None:
        seat = facilities_repo.get_seat(conn, payload.seat_id)
        if seat is None or seat["floor_id"] != payload.floor_id:
            message = "That desk or room is not on the chosen floor."
            raise ValidationError(message, {"seat_id": message})


def register(conn: Connection, payload: RegisterRequest) -> UserOut:
    """Self-registration always produces an employee.

    The role is not read from the request. Administrator and engineer accounts
    are created by an administrator; accepting a role here would let anyone
    register themselves as one.
    """
    # A friendly 409 for the common case. The unique email column still
    # guards against two simultaneous registrations for the same address.
    if users_repo.exists_by_email(conn, payload.email):
        raise ConflictError("An account with this email address already exists.")

    _check_location(conn, payload)
    user = users_repo.create(
        conn,
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role="employee",
        building_id=payload.building_id,
        floor_id=payload.floor_id,
        seat_id=payload.seat_id,
    )
    logger.info("user registered id=%s", user["id"])
    return UserOut(**user)


def login(conn: Connection, payload: LoginRequest) -> TokenResponse:
    """Check the credentials and issue a bearer token.

    Raises AuthenticationError (401) for an unknown address, a wrong password
    or a deactivated account. The first two share one message so the response
    does not reveal which addresses are registered.
    """
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

    # Checked after the password, so only someone who already knows the
    # password learns that the account exists but is deactivated.
    if not user["is_active"]:
        logger.info("sign-in failed: inactive user_id=%s", user["id"])
        raise AuthenticationError("This account has been deactivated.")

    token = create_access_token(
        user_id=user["id"], role=user["role"], email=user["email"]
    )
    # The row was fetched with its hash for the check above; drop it before
    # building the response model.
    public = {k: v for k, v in user.items() if k != "password_hash"}
    logger.info("sign-in ok user_id=%s role=%s", user["id"], user["role"])
    return TokenResponse(
        access_token=token,
        expires_in=settings.access_token_ttl_minutes * 60,
        user=UserOut(**public),
    )

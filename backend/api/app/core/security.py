"""Password hashing and JSON Web Tokens.

Part of `core`: the auth service hashes and checks passwords here, and
`core.deps` decodes the token on every authenticated request.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.core.config import get_settings
from app.core.errors import AuthenticationError

# Cost factor 12, matching what the seed data was generated with.
_BCRYPT_ROUNDS = 12


def hash_password(password: str) -> str:
    """Salted bcrypt hash, stored as text.

    bcrypt (4.2, as pinned) reads only the first 72 bytes of the password and
    ignores the rest; the schemas' 128-character cap does not change that.
    """
    return bcrypt.hashpw(
        password.encode("utf-8"), bcrypt.gensalt(_BCRYPT_ROUNDS)
    ).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Returns False rather than raising, so a malformed stored hash cannot
    surface as a 500."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int, role: str, email: str) -> str:
    """Sign a short-lived access token for this user.

    `role` and `email` are for the client's convenience only. The server takes
    identity from `sub` and reloads the user, so a stale claim grants nothing.
    """
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "role": role,
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_ttl_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """Verify signature and expiry and return the claims, or raise a 401."""
    settings = get_settings()
    try:
        # A fixed algorithm list, so a token cannot choose its own (for
        # example "none") through its header.
        return jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.ExpiredSignatureError:
        raise AuthenticationError(
            "Your session has expired. Please sign in again."
        ) from None
    except jwt.InvalidTokenError:
        # The library's reason is not echoed back: it would tell an attacker
        # which part of a forged token was wrong.
        raise AuthenticationError("Could not validate your credentials.") from None

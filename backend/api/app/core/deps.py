"""Shared dependencies: the database connection, the current user, role gates.

Authorisation is decided on the server. The client hides what a user may not
do, but that is presentation rather than a control.
"""

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg import Connection

from app.core.db import get_connection
from app.core.errors import AuthenticationError, ForbiddenError
from app.core.security import decode_access_token
from app.repositories import users as users_repo
from app.schemas.auth import CurrentUser

# auto_error=False so a missing header raises our error shape, not FastAPI's.
_bearer = HTTPBearer(auto_error=False)

DbConnection = Annotated[Connection, Depends(get_connection)]


def get_current_user(
    conn: DbConnection,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> CurrentUser:
    """Resolve the bearer token to an active user, or raise a 401.

    Role comes from the database row, not from the token's `role` claim, so a
    role change takes effect on the next request.
    """
    if credentials is None:
        raise AuthenticationError("Authentication is required.")

    payload = decode_access_token(credentials.credentials)
    subject = payload.get("sub")
    if subject is None:
        raise AuthenticationError("Could not validate your credentials.")

    # The token is re-checked against the database on every request, so a
    # deactivated account stops working immediately rather than whenever its
    # token happens to expire. `sub` is always a numeric string, because only
    # this service signs tokens.
    user = users_repo.get_by_id(conn, int(subject))
    if user is None or not user["is_active"]:
        raise AuthenticationError("This account is no longer active.")

    return CurrentUser(
        id=user["id"],
        email=user["email"],
        full_name=user["full_name"],
        role=user["role"],
    )


CurrentUserDep = Annotated[CurrentUser, Depends(get_current_user)]


def require_roles(*roles: str):
    """Build a dependency that admits only the given roles.

    An unauthenticated caller gets 401 from `get_current_user` first; a signed-in
    caller with the wrong role gets 403.
    """

    def dependency(user: CurrentUserDep) -> CurrentUser:
        if user.role not in roles:
            raise ForbiddenError("You do not have access to this resource.")
        return user

    return dependency


# Role gates for route signatures. They only decide who may call an endpoint;
# per-record rules (the reporter, the assignee) are checked in the services.
AdminUser = Annotated[CurrentUser, Depends(require_roles("admin"))]
EngineerUser = Annotated[CurrentUser, Depends(require_roles("engineer"))]
StaffUser = Annotated[CurrentUser, Depends(require_roles("admin", "engineer"))]

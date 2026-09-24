"""Authentication endpoints.

Thin HTTP layer over `app.services.auth`, which holds the registration and
sign-in rules. `/register` and `/login` are the only unauthenticated routes
besides `/health`.
"""

from fastapi import APIRouter, status

from app.core.deps import CurrentUserDep, DbConnection
from app.repositories import users as users_repo
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.services import auth as service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, conn: DbConnection) -> UserOut:
    """Self-registration for employees with a company email address.

    Open to anyone, no token needed. The new account is always an employee;
    engineers and administrators are created by an administrator. Returns the
    user but no token, so the client signs in next.

    Errors: 400 for an address outside @acme.inc or a weak password, 409 if the
    address is already registered.
    """
    return service.register(conn, payload)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, conn: DbConnection) -> TokenResponse:
    """Exchange email and password for a bearer token and the user's profile.

    Open to anyone. Send the token as `Authorization: Bearer <token>`;
    `expires_in` is in seconds. A wrong address and a wrong password give the
    same 401, so the response does not reveal who has an account. A
    deactivated account gets its own 401.
    """
    return service.login(conn, payload)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUserDep, conn: DbConnection) -> UserOut:
    """The signed-in user. The client reads the role here to choose a
    dashboard."""
    # Reloaded rather than built from `user`, which carries only the fields
    # needed for authorisation. The dependency has already proved the row
    # exists and is active.
    return UserOut(**users_repo.get_by_id(conn, user.id))

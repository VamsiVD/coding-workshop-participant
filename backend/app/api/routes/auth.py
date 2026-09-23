"""Authentication endpoints."""

from fastapi import APIRouter, status

from app.core.deps import CurrentUserDep, DbConnection
from app.repositories import users as users_repo
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserOut
from app.services import auth as service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, conn: DbConnection) -> UserOut:
    """Self-registration for employees with a company email address."""
    return service.register(conn, payload)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, conn: DbConnection) -> TokenResponse:
    return service.login(conn, payload)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUserDep, conn: DbConnection) -> UserOut:
    """The signed-in user. The client reads the role here to choose a
    dashboard."""
    return UserOut(**users_repo.get_by_id(conn, user.id))

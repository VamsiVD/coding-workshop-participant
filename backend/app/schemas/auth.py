"""Registration, sign-in and the authenticated caller."""

from datetime import datetime

from pydantic import EmailStr, Field, field_validator

from app.schemas.common import ApiModel, ApiResponse, UserRole

# Matches the users_email_domain CHECK constraint in the schema. Kept as a
# constant so the rule is stated once on this side of the boundary too.
COMPANY_EMAIL_DOMAIN = "acme.inc"


def normalise_email(value: str) -> str:
    """Lower-case and trim, so the value matches what the database's
    case-insensitive unique index compares against."""
    return value.strip().lower()


class RegisterRequest(ApiModel):
    """Self-registration.

    There is deliberately no `role` field. Role is assigned by the server, not
    chosen by the registrant: accepting it here would let anyone sign up as an
    administrator.
    """

    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    full_name: str = Field(min_length=1, max_length=120)

    @field_validator("email")
    @classmethod
    def company_domain_only(cls, value: str) -> str:
        email = normalise_email(value)
        if not email.endswith(f"@{COMPANY_EMAIL_DOMAIN}"):
            raise ValueError(
                f"Registration is open to @{COMPANY_EMAIL_DOMAIN} addresses only."
            )
        return email

    @field_validator("password")
    @classmethod
    def not_a_single_character_class(cls, value: str) -> str:
        if value.isalpha() or value.isdigit():
            raise ValueError("Use a password with both letters and numbers.")
        return value


class LoginRequest(ApiModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalise(cls, value: str) -> str:
        return normalise_email(value)


class UserOut(ApiResponse):
    """A user as the API returns it.

    `password_hash` is absent by construction. Adding it here is the only way
    it could ever reach a client, which is why the field list is explicit.
    """

    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TokenResponse(ApiResponse):
    access_token: str
    # noqa below: "bearer" is the OAuth token type, not a credential.
    token_type: str = "bearer"  # noqa: S105
    expires_in: int = Field(description="Token lifetime in seconds.")
    user: UserOut


class CurrentUser(ApiResponse):
    """The authenticated caller, resolved from the bearer token per request."""

    id: int
    email: str
    full_name: str
    role: UserRole

    @property
    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN

    @property
    def is_engineer(self) -> bool:
        return self.role == UserRole.ENGINEER

    @property
    def is_employee(self) -> bool:
        return self.role == UserRole.EMPLOYEE

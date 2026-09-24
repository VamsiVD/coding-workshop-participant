"""Registration, sign-in and the authenticated caller.

Request and response models for the auth routes. The rules behind them
(role assignment, password checks, token issue) live in `app.services.auth`.
"""

from datetime import datetime

from pydantic import EmailStr, Field, field_validator, model_validator

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
    # Where the employee works. Optional here so API clients that predate it
    # keep working; the registration form asks for building and floor. The
    # seat must be a desk; rooms are for incident reports.
    building_id: int | None = None
    floor_id: int | None = None
    seat_id: int | None = None

    @model_validator(mode="after")
    def location_is_a_path(self) -> "RegisterRequest":
        # Mirrors users_floor_needs_building and users_seat_needs_floor: each
        # level needs the one above it. Whether they actually belong together
        # is checked against the database in the service.
        if self.floor_id is not None and self.building_id is None:
            raise ValueError("Choose a building for this floor.")
        if self.seat_id is not None and self.floor_id is None:
            raise ValueError("Choose a floor for this desk.")
        return self

    @field_validator("email")
    @classmethod
    def company_domain_only(cls, value: str) -> str:
        """Only company addresses may register, normalised before the check so
        " Jane@ACME.inc " is accepted and stored as "jane@acme.inc"."""
        email = normalise_email(value)
        if not email.endswith(f"@{COMPANY_EMAIL_DOMAIN}"):
            raise ValueError(
                f"Registration is open to @{COMPANY_EMAIL_DOMAIN} addresses only."
            )
        return email

    @field_validator("password")
    @classmethod
    def not_a_single_character_class(cls, value: str) -> str:
        """Reject passwords made only of letters or only of digits.

        A light rule on top of the length limit: it blocks the weakest choices
        ("password12" passes, "passwordpassword" and "1234567890" do not)
        without a full strength meter.
        """
        if value.isalpha() or value.isdigit():
            raise ValueError("Use a password with both letters and numbers.")
        return value


class LoginRequest(ApiModel):
    """Sign-in with email and password.

    The password has no strength rule here, only a length cap: sign-in only
    compares it with the stored hash, and accounts an administrator creates
    (engineers) are not held to the registration password rule.
    """

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalise(cls, value: str) -> str:
        # Same normalisation as registration, so the lookup finds the account
        # whatever case the user types. No domain check: a wrong domain simply
        # fails to sign in with the generic message.
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
    # The user's workplace, if they gave one at registration.
    building_id: int | None = None
    floor_id: int | None = None
    seat_id: int | None = None
    created_at: datetime
    updated_at: datetime


class TokenResponse(ApiResponse):
    """Successful sign-in: a bearer token plus the signed-in user, so the
    client can render the right persona without a second request."""

    access_token: str
    # noqa below: "bearer" is the OAuth token type, not a credential.
    token_type: str = "bearer"  # noqa: S105
    expires_in: int = Field(description="Token lifetime in seconds.")
    user: UserOut


class CurrentUser(ApiResponse):
    """The authenticated caller, resolved from the bearer token per request.

    Services receive this rather than a bare user id, so role and ownership
    checks need no further database lookup. The `is_*` properties are
    conveniences for server code; being plain properties, they are not
    serialised into responses.
    """

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

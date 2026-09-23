"""Engineer profiles.

An engineer is a user with a profile row. Creating one therefore creates both,
which is why `EngineerCreate` carries the account fields alongside the profile
fields.
"""

from datetime import datetime

from pydantic import EmailStr, Field, field_validator

from app.schemas.auth import COMPANY_EMAIL_DOMAIN, normalise_email
from app.schemas.common import ApiModel, ApiResponse, CategorySummary


class EngineerCreate(ApiModel):
    """Administrator creates the account and the profile in one call."""

    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    full_name: str = Field(min_length=1, max_length=120)
    specialization_id: int | None = Field(
        default=None, description="Category this engineer primarily handles."
    )
    phone: str | None = Field(default=None, max_length=40)
    max_active_tickets: int = Field(default=5, ge=1, le=100)
    is_available: bool = True

    @field_validator("email")
    @classmethod
    def company_domain_only(cls, value: str) -> str:
        email = normalise_email(value)
        if not email.endswith(f"@{COMPANY_EMAIL_DOMAIN}"):
            raise ValueError(f"Use an @{COMPANY_EMAIL_DOMAIN} address.")
        return email


class EngineerUpdate(ApiModel):
    """Administrator edit. Deactivating the account is done through the user
    endpoint, not here."""

    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    specialization_id: int | None = None
    phone: str | None = Field(default=None, max_length=40)
    max_active_tickets: int | None = Field(default=None, ge=1, le=100)
    is_available: bool | None = None


class EngineerAvailabilityUpdate(ApiModel):
    """The one field an engineer may change on their own profile."""

    is_available: bool


class EngineerOut(ApiResponse):
    user_id: int
    email: str
    full_name: str
    is_active: bool
    is_available: bool
    max_active_tickets: int
    phone: str | None
    specialization: CategorySummary | None = None
    created_at: datetime
    updated_at: datetime


class EngineerWorkload(ApiResponse):
    """An engineer with their current load, for the assignment picker and the
    workload report. `at_capacity` is computed rather than stored so it cannot
    disagree with the counts beside it."""

    user_id: int
    full_name: str
    is_available: bool
    max_active_tickets: int
    specialization: CategorySummary | None = None
    open_tickets: int = 0
    in_progress_tickets: int = 0
    blocked_tickets: int = 0

    @property
    def active_tickets(self) -> int:
        return self.open_tickets + self.in_progress_tickets + self.blocked_tickets

    @property
    def at_capacity(self) -> bool:
        return self.active_tickets >= self.max_active_tickets

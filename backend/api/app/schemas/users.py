"""Request and response models for administrators managing people.

Used by `app.api.routes.users`; the rules are in `app.services.users`.
"""

from datetime import datetime

from pydantic import Field

from app.schemas.common import ApiModel, ApiResponse, UserRole


class UserFilters(ApiModel):
    """Query string for the people list."""

    q: str | None = Field(default=None, min_length=2, max_length=120)
    role: UserRole | None = None
    include_inactive: bool = True


class EngineerProfileFields(ApiModel):
    """Profile settings used when someone becomes, or stays, an engineer.
    Omitted fields keep their current value (or the default for a new profile)."""

    specialization_id: int | None = None
    phone: str | None = Field(default=None, max_length=40)
    max_active_tickets: int | None = Field(default=None, ge=1, le=100)
    is_available: bool | None = None


class UserUpdate(ApiModel):
    """Administrator change to one account. Every field is optional."""

    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    role: UserRole | None = None
    is_active: bool | None = None
    # Only with role engineer (new or current).
    engineer: EngineerProfileFields | None = None


class UserAdminOut(ApiResponse):
    """An account as the admin's people list shows it."""

    id: int
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    building_id: int | None = None
    floor_id: int | None = None
    seat_id: int | None = None
    created_at: datetime

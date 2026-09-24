"""Buildings, floors and seats.

Field lengths match the varchar widths in the schema, so an over-long value is
rejected at the edge with a useful message rather than by the database with a
constraint name.
"""

from datetime import datetime

from pydantic import Field, field_validator

from app.schemas.common import ApiModel, ApiResponse

# ---------------------------------------------------------------------------
# Buildings
# ---------------------------------------------------------------------------


class BuildingCreate(ApiModel):
    """Administrator adds a building. It starts active."""

    name: str = Field(min_length=1, max_length=120)
    code: str = Field(min_length=1, max_length=20, examples=["HQ1"])
    address: str | None = Field(default=None, max_length=255)

    @field_validator("code")
    @classmethod
    def upper_case_code(cls, value: str) -> str:
        # Codes are displayed and searched in upper case; normalising here
        # keeps the unique index from admitting "hq1" alongside "HQ1".
        return value.strip().upper()


class BuildingUpdate(ApiModel):
    """PATCH body. Every field optional; omitted fields are left alone."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    code: str | None = Field(default=None, min_length=1, max_length=20)
    address: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None

    @field_validator("code")
    @classmethod
    def upper_case_code(cls, value: str | None) -> str | None:
        # Same normalisation as on create; None (field omitted or null) is
        # passed through untouched.
        return value.strip().upper() if value else value


class BuildingOut(ApiResponse):
    """A building as the API returns it. Inactive buildings are kept for
    history but hidden from the report form."""

    id: int
    name: str
    code: str
    address: str | None
    is_active: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# Floors
# ---------------------------------------------------------------------------


class FloorCreate(ApiModel):
    """A floor within a building; the building comes from the URL path.

    `level` is unique within its building (floors_unique_level). Negative
    levels are basements.
    """

    level: int = Field(ge=-10, le=200, description="0 is the ground floor.")
    label: str | None = Field(default=None, max_length=60, examples=["Ground Floor"])


class FloorUpdate(ApiModel):
    """PATCH body. Every field optional; omitted fields are left alone. A
    floor cannot be moved to another building."""

    level: int | None = Field(default=None, ge=-10, le=200)
    label: str | None = Field(default=None, max_length=60)


class FloorOut(ApiResponse):
    """A floor as the API returns it."""

    id: int
    building_id: int
    level: int
    label: str | None
    created_at: datetime


# ---------------------------------------------------------------------------
# Seats
# ---------------------------------------------------------------------------


class SeatCreate(ApiModel):
    """A seat on a floor; the floor comes from the URL path. The code is unique
    within its floor (seats_unique_code)."""

    code: str = Field(min_length=1, max_length=40, examples=["HQ1-2F-A01"])

    @field_validator("code")
    @classmethod
    def upper_case_code(cls, value: str) -> str:
        # Upper-cased for the same reason as building codes: one spelling per
        # seat, so the unique constraint means what it says.
        return value.strip().upper()


class SeatUpdate(ApiModel):
    """PATCH body. Only the code can change; a seat stays on its floor."""

    code: str | None = Field(default=None, min_length=1, max_length=40)

    @field_validator("code")
    @classmethod
    def upper_case_code(cls, value: str | None) -> str | None:
        # None (field omitted or null) is passed through untouched.
        return value.strip().upper() if value else value


class SeatOut(ApiResponse):
    """A seat as the API returns it."""

    id: int
    floor_id: int
    code: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Nested tree, for the cascading building / floor / seat pickers
# ---------------------------------------------------------------------------


class SeatNode(ApiResponse):
    """Leaf of the facility tree: just enough to fill the seat dropdown."""

    id: int
    code: str


class FloorNode(ApiResponse):
    """A floor in the facility tree, with its seats nested."""

    id: int
    level: int
    label: str | None
    # A mutable default is safe here: Pydantic copies it per instance.
    seats: list[SeatNode] = []


class BuildingNode(ApiResponse):
    """A building in the facility tree, with its floors nested."""

    id: int
    name: str
    code: str
    floors: list[FloorNode] = []


class FacilityTree(ApiResponse):
    """One call that fills all three dropdowns on the report form, rather than
    three round trips as the user works down the hierarchy."""

    buildings: list[BuildingNode]

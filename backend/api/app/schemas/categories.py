"""Issue categories.

Request and response models for the category routes; the rules (refusing to
delete a category in use) live in `app.services.categories`.
"""

from pydantic import Field

from app.schemas.common import ApiModel, ApiResponse, CategoryType


class CategoryCreate(ApiModel):
    """Administrator adds a category. It starts active, so it appears on the
    report form straight away."""

    label: str = Field(min_length=1, max_length=80, examples=["HVAC"])
    category_type: CategoryType


class CategoryUpdate(ApiModel):
    """PATCH body. Every field optional; omitted fields are left alone."""

    label: str | None = Field(default=None, min_length=1, max_length=80)
    category_type: CategoryType | None = None
    # Categories are deactivated rather than deleted, because incidents
    # reference them and the foreign key is ON DELETE RESTRICT.
    is_active: bool | None = None


class CategoryOut(ApiResponse):
    """A category as the API returns it. `is_active` is included because the
    list can be asked to return deactivated categories too."""

    id: int
    label: str
    category_type: CategoryType
    is_active: bool

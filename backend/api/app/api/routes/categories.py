"""Issue categories. Everyone reads, administrators write.

HTTP layer only: the rules live in `app.services.categories`.
"""

from fastapi import APIRouter, status

from app.core.deps import AdminUser, CurrentUserDep, DbConnection
from app.schemas.categories import CategoryCreate, CategoryOut, CategoryUpdate
from app.schemas.common import DeletedResponse
from app.services import categories as service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(
    conn: DbConnection, _: CurrentUserDep, include_inactive: bool = False
):
    """All categories, for the report form's picker. Any signed-in user.

    Deactivated categories are hidden unless `include_inactive=true`, which
    lets an admin screen show them so they can be re-enabled.
    """
    return service.list_categories(conn, include_inactive)


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, conn: DbConnection, _: AdminUser):
    """Add a category. Administrators only; 409 if the label is already taken."""
    return service.create_category(conn, payload)


@router.get("/{category_id}", response_model=CategoryOut)
def get_category(category_id: int, conn: DbConnection, _: CurrentUserDep):
    return service.get_category(conn, category_id)


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int, payload: CategoryUpdate, conn: DbConnection, _: AdminUser
):
    """Change a category's label, type or active flag. Administrators only.

    Only the fields sent are changed. Setting `is_active` to false is how a
    category in use is retired.
    """
    return service.update_category(conn, category_id, payload)


@router.delete("/{category_id}", response_model=DeletedResponse)
def delete_category(category_id: int, conn: DbConnection, _: AdminUser):
    """Delete an unused category. Administrators only.

    409 while any incident uses it; deactivate it instead, so those incidents
    keep their classification.
    """
    service.delete_category(conn, category_id)
    return DeletedResponse(id=category_id)

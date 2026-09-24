"""Category rules.

Sits between the category routes and the categories repository. Reads are
open to any signed-in user; the routes restrict writes to administrators.
"""

from psycopg import Connection

from app.core.errors import ConflictError, NotFoundError
from app.repositories import categories as repo


def list_categories(conn: Connection, include_inactive: bool = False) -> list[dict]:
    """Active categories by default, which is what the report form offers."""
    return repo.list_all(conn, active_only=not include_inactive)


def get_category(conn: Connection, category_id: int) -> dict:
    """Fetch one category, or raise NotFoundError (404)."""
    category = repo.get(conn, category_id)
    if category is None:
        raise NotFoundError("Category not found.")
    return category


def create_category(conn: Connection, payload) -> dict:
    """Add a category. A duplicate label is refused by the unique constraint
    on `categories.label`."""
    return repo.create(
        conn, label=payload.label, category_type=payload.category_type.value
    )


def update_category(conn: Connection, category_id: int, payload) -> dict:
    """Apply a partial update. Deactivating is done here, via `is_active`."""
    # Existence check first, so a bad id is a 404 rather than an empty update.
    get_category(conn, category_id)
    # exclude_unset keeps only the fields the client sent, so an omitted field
    # is left alone rather than overwritten with None.
    changes = payload.model_dump(exclude_unset=True)
    # The repository binds plain strings; unwrap the enum for the SQL cast.
    if "category_type" in changes and changes["category_type"] is not None:
        changes["category_type"] = changes["category_type"].value
    return repo.update(conn, category_id, changes)


def delete_category(conn: Connection, category_id: int) -> None:
    """Refused while incidents reference it.

    Deactivation is the intended path: the category disappears from the
    report form while historical incidents keep their classification.
    """
    get_category(conn, category_id)
    count = repo.incident_count(conn, category_id)
    if count:
        raise ConflictError(
            f"{count} incident(s) use this category. Deactivate it instead, so "
            "existing incidents keep their classification."
        )
    repo.delete(conn, category_id)

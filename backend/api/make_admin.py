"""TEMPORARY: promote an existing account to administrator.

Reached only by a direct Lambda invocation (`bin/make-admin.sh`), which needs
the participant's AWS credentials; browser requests cannot reach it, so the
public site gains no way to become an admin. Delete this file, its branch in
`function.py` and `bin/make-admin.sh` once a real admin screen for roles exists.
"""

import logging

import psycopg
from psycopg.rows import dict_row

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def make_admin(email: str) -> dict:
    """Set the account's role to admin. Returns the account, or an error."""
    email = (email or "").strip().lower()
    if not email:
        return {"error": "Give the email address of an existing account."}
    settings = get_settings()
    # Aurora Serverless may be paused; resuming takes up to ~15 seconds.
    with psycopg.connect(
        settings.database_url, connect_timeout=30, autocommit=True, row_factory=dict_row
    ) as conn:
        user = conn.execute(
            """
            UPDATE users SET role = 'admin'
            WHERE email = %(email)s
            RETURNING id, email, full_name, role, is_active
            """,
            {"email": email},
        ).fetchone()
    if user is None:
        return {"error": f"No account with the email {email}."}
    logger.warning("promoted to admin via direct invoke: user id=%s", user["id"])
    return {"user": user}

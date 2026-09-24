"""Apply the SQL in `db/init` to the configured database.

The same scripts initialise the local Docker database on first start. Here they
run on demand, for databases such as Aurora that nothing else initialises. Each
step checks whether it has already run, so invoking this again is safe.

`01_schema.sql` and `02_seed.sql` run once, guarded by the checks below. Every
later file (`03_...` onwards) is an additive change written to be idempotent
(`IF NOT EXISTS`), and runs on every invocation; that is how a database
created before the file existed picks the change up.
"""

import logging
from pathlib import Path

import psycopg

from app.core.config import get_settings

logger = logging.getLogger(__name__)

INIT_DIR = Path(__file__).parent / "db" / "init"

# Run once, under their own guards; everything else in INIT_DIR is additive.
ONE_OFF = {"01_schema.sql", "02_seed.sql"}


def migrate(seed: bool = False, dummy: bool = False) -> dict:
    """Create the schema if missing and, when asked, load the dev seed data.

    `dummy` adds the bulk data in `db/seed_dummy.sql`, which builds on the seed,
    so it implies `seed`.
    """
    seed = seed or dummy
    settings = get_settings()
    applied = []
    # A direct connection rather than the app's pool, since this runs once and
    # outside any request.
    # Aurora Serverless may be paused; resuming takes up to ~15 seconds.
    with psycopg.connect(settings.database_url, connect_timeout=30, autocommit=True) as conn:
        # to_regclass returns NULL for a missing table instead of raising, so it
        # is a safe probe. The users table stands in for the whole schema.
        has_schema = conn.execute("SELECT to_regclass('public.users') IS NOT NULL").fetchone()[0]
        if not has_schema:
            # The scripts hold their own BEGIN/COMMIT, so they run as-is.
            conn.execute((INIT_DIR / "01_schema.sql").read_text())
            applied.append("01_schema.sql")

        # Additive changes, in filename order. Idempotent, so they run every
        # time rather than being tracked.
        for path in sorted(INIT_DIR.glob("*.sql")):
            if path.name not in ONE_OFF:
                conn.execute(path.read_text())
                applied.append(path.name)

        if seed:
            # Seed only an empty database, so dev accounts are never mixed into
            # one that already has real users.
            has_users = conn.execute("SELECT EXISTS (SELECT 1 FROM users)").fetchone()[0]
            if not has_users:
                conn.execute((INIT_DIR / "02_seed.sql").read_text())
                applied.append("02_seed.sql")

        if dummy:
            # Running the script twice would add a second batch; one of its
            # users marks that it has already run.
            has_dummy = conn.execute(
                "SELECT EXISTS (SELECT 1 FROM users WHERE email = 'ravi.menon@acme.inc')"
            ).fetchone()[0]
            if not has_dummy:
                conn.execute((INIT_DIR.parent / "seed_dummy.sql").read_text())
                applied.append("seed_dummy.sql")

    logger.info("migration applied: %s", applied or "nothing")
    return {"applied": applied}

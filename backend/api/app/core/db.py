"""Connection handling.

A module-level pool is reused across Lambda invocations in the same container,
so the connection cost stays off the request path after the first call.
"""

import logging
from collections.abc import Iterator
from contextlib import contextmanager

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_pool: ConnectionPool | None = None


def get_pool() -> ConnectionPool:
    """Return the process-wide pool, creating it on first use.

    Lazy creation is what lets Lambda run without an ASGI lifespan: the first
    request of a cold container opens the pool, later ones reuse it.
    """
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = ConnectionPool(
            conninfo=settings.database_url,
            min_size=1,
            # A Lambda container serves one request at a time, so a larger
            # pool would only hold idle connections open against the database.
            max_size=4,
            # Seconds a request waits for a free connection before failing.
            timeout=10,
            open=True,
            # Autocommit, with explicit transactions in the service layer.
            #
            # FastAPI runs the teardown of a `yield` dependency *after* the
            # response has been sent, so committing there hands the client a
            # 201 for a row that is not yet visible to the next request. A
            # fast client can then read its own write and get a 404. Committing
            # inside the endpoint, through `conn.transaction()`, closes that
            # window.
            kwargs={"row_factory": dict_row, "autocommit": True},
        )
        logger.info("database pool created")
    return _pool


def close_pool() -> None:
    """Close the pool at shutdown. Only the local server's lifespan calls it;
    a Lambda container is frozen or discarded without notice."""
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
        logger.info("database pool closed")


@contextmanager
def connection() -> Iterator[Connection]:
    """A pooled connection in autocommit mode.

    Single-statement writes commit as they run. An operation that writes more
    than one row wraps itself in `transaction()` below, so it is still all or
    nothing.
    """
    with get_pool().connection() as conn:
        yield conn


@contextmanager
def transaction(conn: Connection) -> Iterator[Connection]:
    """Group several writes into one atomic unit.

    Commits when the block ends and rolls back if it raises, so an incident
    transition cannot be recorded without its audit event, and a failed one
    leaves neither behind. The commit happens here, inside the request, rather
    than in dependency teardown after the response has gone out.
    """
    with conn.transaction():
        yield conn


def get_connection() -> Iterator[Connection]:
    """FastAPI dependency wrapping `connection`.

    The connection goes back to the pool in teardown, after the response. It
    commits nothing there, which is why writes commit inside the endpoint.
    """
    with connection() as conn:
        yield conn

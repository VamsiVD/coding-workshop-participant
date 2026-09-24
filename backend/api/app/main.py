"""FastAPI application for the ACME facility incident management API.

Assembles the app: CORS, request logging, the error handlers from `core.errors`
and one router per resource from `api.routes`. `function.py` wraps it for Lambda;
locally it runs under uvicorn.
"""

import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    assignment_requests,
    auth,
    categories,
    engineers,
    facilities,
    incidents,
    notes,
    reports,
    users,
)
from app.core.config import get_settings
from app.core.db import close_pool, connection, get_pool
from app.core.errors import register_error_handlers

# Read at import, so a missing or short JWT secret fails the cold start rather
# than the first request that needs it.
settings = get_settings()

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Open the pool at startup and close it at shutdown.

    Only a local server such as uvicorn runs this. On Lambda, Mangum has the
    lifespan turned off and the pool opens on the first request instead.
    """
    get_pool()
    yield
    close_pool()


app = FastAPI(
    title="ACME Facility Incident Management API",
    description=(
        "Self-service reporting and tracking of facility and workplace "
        "technology issues, with role-based access for employees, engineers "
        "and facility administrators."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# Only the configured origins may call the API. Never "*" alongside
# credentials.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

register_error_handlers(app)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Method, path, status and duration. Never the body, never the token."""
    started = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - started) * 1000
    logger.info(
        "%s %s status=%s duration=%.1fms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.get("/health", tags=["health"])
def health() -> dict:
    """Liveness, including a real database round trip.

    Needs no authentication. Always answers 200; a database fault shows as
    `"status": "degraded"` in the body rather than as an error status.
    """
    try:
        with connection() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1 AS ok")
            cur.fetchone()
        return {"status": "ok", "database": "ok"}
    except Exception:
        # The cause goes to the log only; the public body names no internals.
        logger.exception("health check failed")
        return {"status": "degraded", "database": "unavailable"}


# Every resource lives under /api; only /health sits at the root.
# assignment_requests comes before incidents so /incidents/pool is matched
# before /incidents/{incident_id}.
for module in (
    auth,
    facilities,
    categories,
    engineers,
    assignment_requests,
    incidents,
    notes,
    reports,
    users,
):
    app.include_router(module.router, prefix="/api")

"""FastAPI application for the ACME facility incident management API."""

import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    auth,
    categories,
    engineers,
    facilities,
    incidents,
    notes,
    reports,
)
from app.core.config import get_settings
from app.core.db import close_pool, connection, get_pool
from app.core.errors import register_error_handlers

settings = get_settings()

logging.basicConfig(
    level=settings.log_level,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
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
    """Liveness, including a real database round trip."""
    try:
        with connection() as conn, conn.cursor() as cur:
            cur.execute("SELECT 1 AS ok")
            cur.fetchone()
        return {"status": "ok", "database": "ok"}
    except Exception:
        logger.exception("health check failed")
        return {"status": "degraded", "database": "unavailable"}


for module in (auth, facilities, categories, engineers, incidents, notes, reports):
    app.include_router(module.router, prefix="/api")

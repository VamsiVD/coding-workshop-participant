"""Error types and the handlers that render them.

Every error response has the same shape, so the client can rely on it:

    {"success": false,
     "error": {"code": "...", "message": "...", "fields": {...}}}

Routes and services raise; they never build an error response themselves.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from psycopg import errors as pg_errors
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base for errors the client is meant to see.

    Subclasses set the HTTP status and the machine-readable `code`. `message`
    is shown to the user, so it must be safe and written for them; `fields`
    maps input names to per-field messages for a form to highlight.
    """

    status_code = status.HTTP_400_BAD_REQUEST
    code = "BAD_REQUEST"

    def __init__(self, message: str, fields: dict[str, str] | None = None):
        super().__init__(message)
        self.message = message
        self.fields = fields


class ValidationError(AppError):
    status_code = status.HTTP_400_BAD_REQUEST
    code = "VALIDATION_ERROR"


class AuthenticationError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "AUTHENTICATION_ERROR"


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "FORBIDDEN"


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "NOT_FOUND"


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "CONFLICT"


def error_body(code: str, message: str, fields: dict[str, Any] | None = None) -> dict:
    """Build the error envelope described above. `fields` is left out when
    empty, so the client can test for its presence."""
    body: dict[str, Any] = {
        "success": False,
        "error": {"code": code, "message": message},
    }
    if fields:
        body["error"]["fields"] = fields
    return body


def register_error_handlers(app: FastAPI) -> None:
    """Attach a handler for each error family, all rendering `error_body`.

    Starlette picks the handler for the most specific class in the exception's
    MRO, so the catch-all `Exception` handler only sees what nothing else
    claims.
    """

    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(exc.code, exc.message, exc.fields),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_request_validation(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # Flatten pydantic's error list into {field: message}, which is what a
        # form needs in order to highlight the offending input.
        fields = {}
        for error in exc.errors():
            location = [str(part) for part in error["loc"] if part != "body"]
            fields[".".join(location) or "body"] = error["msg"]
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=jsonable_encoder(
                error_body("VALIDATION_ERROR", "The request data is invalid.", fields)
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(
        _: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        # Errors raised by the framework itself, such as an unknown path (404)
        # or an unsupported method (405), rewrapped in our shape.
        codes = {401: "AUTHENTICATION_ERROR", 403: "FORBIDDEN", 404: "NOT_FOUND"}
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(
                codes.get(exc.status_code, "HTTP_ERROR"), str(exc.detail)
            ),
        )

    @app.exception_handler(pg_errors.UniqueViolation)
    async def handle_unique_violation(
        _: Request, exc: pg_errors.UniqueViolation
    ) -> JSONResponse:
        # The constraint name describes the schema, so it is logged rather
        # than returned.
        logger.warning("unique violation: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content=error_body("CONFLICT", "That record already exists."),
        )

    @app.exception_handler(pg_errors.ForeignKeyViolation)
    async def handle_fk_violation(
        _: Request, exc: pg_errors.ForeignKeyViolation
    ) -> JSONResponse:
        # Covers both directions: inserting a row that points at a missing id,
        # and deleting a row that others still point at.
        logger.warning("foreign key violation: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=error_body(
                "VALIDATION_ERROR",
                "One of the records you referenced does not exist, or is still in use.",
            ),
        )

    @app.exception_handler(pg_errors.CheckViolation)
    async def handle_check_violation(
        _: Request, exc: pg_errors.CheckViolation
    ) -> JSONResponse:
        # Reaching here means a rule the database enforces was not also
        # checked in the service layer. Worth logging loudly.
        logger.warning("check violation: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content=error_body(
                "VALIDATION_ERROR", "That change is not allowed for this record."
            ),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        # Full detail to the log, nothing internal to the client.
        logger.exception("unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content=error_body("INTERNAL_ERROR", "An unexpected error occurred."),
        )

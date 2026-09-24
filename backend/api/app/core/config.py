"""Configuration, read from the environment.

Variable names match the ones the workshop Terraform injects into the Lambda
environment (infra/locals.tf), so one settings object serves both local
development and the deployed service.
"""

from functools import lru_cache

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Every setting the API reads, one field per environment variable.

    Field names match the variables case-insensitively, so `postgres_host`
    reads POSTGRES_HOST. The defaults suit local development; the deployed
    Lambda overrides them.
    """

    # `.env` is a local convenience; on Lambda the variables come from the
    # function's environment. `extra="ignore"` because that environment also
    # carries variables meant for other code.
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Database ---
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_name: str = "acme_incidents"
    postgres_user: str = "acme"
    postgres_pass: str = ""

    # --- Authentication ---
    # No default. An unset secret must stop the process, not quietly produce
    # tokens that anyone could forge.
    jwt_secret: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 60

    # --- HTTP ---
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # --- Environment ---
    # Terraform sets this false on real AWS, which turns on TLS to Aurora in
    # `database_url` below.
    is_local: bool = True
    log_level: str = "INFO"

    @computed_field
    @property
    def database_url(self) -> str:
        """libpq connection string. TLS is required outside local development."""
        sslmode = "disable" if self.is_local else "require"
        return (
            f"host={self.postgres_host} port={self.postgres_port} "
            f"dbname={self.postgres_name} user={self.postgres_user} "
            f"password={self.postgres_pass} sslmode={sslmode}"
        )


@lru_cache
def get_settings() -> Settings:
    """Cached, so the environment is read once per process rather than per
    request."""
    return Settings()

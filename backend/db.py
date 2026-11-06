import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

import asyncpg
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL")

_pool: asyncpg.Pool | None = None


# --------------------------------------------------
# Database Connection
# --------------------------------------------------

async def connect_db() -> None:
    """Create the PostgreSQL pool and initialize database tables."""
    global _pool

    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured.")

    if _pool is not None:
        return

    pool = await asyncpg.create_pool(
        dsn=DATABASE_URL,
        min_size=1,
        max_size=10,
        command_timeout=30,
    )

    _pool = pool

    try:
        await create_tables()
        logger.info("PostgreSQL connection established.")
    except Exception:
        await pool.close()
        _pool = None
        logger.exception("Database schema initialization failed.")
        raise


async def close_db() -> None:
    """Close the PostgreSQL connection pool."""
    global _pool

    if _pool is not None:
        pool = _pool
        _pool = None

        await pool.close()
        logger.info("PostgreSQL connection pool closed.")


def get_pool() -> asyncpg.Pool:
    """Return the initialized connection pool."""
    if _pool is None:
        raise RuntimeError("Database connection is not initialized.")

    return _pool


@asynccontextmanager
async def get_connection():
    """Acquire and release a database connection."""
    pool = get_pool()

    async with pool.acquire() as connection:
        yield connection


# --------------------------------------------------
# JSON Serialization Helpers
# --------------------------------------------------

def serialize_value(value: Any) -> Any:
    """Convert database and Python values into JSON-compatible values."""

    if isinstance(value, UUID):
        return str(value)

    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)

        return value.astimezone(timezone.utc).isoformat()

    if isinstance(value, dict):
        return {
            str(key): serialize_value(item)
            for key, item in value.items()
        }

    if isinstance(value, (list, tuple)):
        return [serialize_value(item) for item in value]

    return value


def _decode_analysis_result(value: Any, analysis_id: Any) -> Any:
    """
    Decode JSONB values returned as strings.

    asyncpg commonly returns JSON/JSONB as strings unless a custom
    codec is configured. Preserve compatibility with dictionary values.
    """
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            logger.warning(
                "Could not decode analysis_result for analysis %s.",
                analysis_id,
            )

    return value


# --------------------------------------------------
# Database Schema
# --------------------------------------------------

async def create_tables() -> None:
    """Create the users and analyses tables if they do not exist."""

    async with get_connection() as connection:
        await connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )

        await connection.execute(
            """
            CREATE TABLE IF NOT EXISTS analyses (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL REFERENCES users(id)
                    ON DELETE CASCADE,
                region TEXT NOT NULL,
                resources_scanned INTEGER NOT NULL DEFAULT 0,
                issues_found INTEGER NOT NULL DEFAULT 0,
                estimated_savings TEXT NOT NULL DEFAULT '',
                analysis_result JSONB NOT NULL DEFAULT '{}'::jsonb,
                status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (
                        status IN (
                            'pending',
                            'in_progress',
                            'completed',
                            'failed'
                        )
                    ),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )

        await connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_analyses_user_created
            ON analyses (user_id, created_at DESC);
            """
        )

    logger.info("Database tables verified.")


# --------------------------------------------------
# User Queries
# --------------------------------------------------

async def create_user(
    user_id: UUID,
    email: str,
    password_hash: str,
) -> dict[str, Any]:
    """Create a user and return public user fields."""

    async with get_connection() as connection:
        row = await connection.fetchrow(
            """
            INSERT INTO users (id, email, password_hash)
            VALUES ($1, $2, $3)
            RETURNING id, email, created_at;
            """,
            user_id,
            email,
            password_hash,
        )

    return dict(row)


async def get_user_by_email(
    email: str,
) -> dict[str, Any] | None:
    """Retrieve a user by email for authentication."""

    async with get_connection() as connection:
        row = await connection.fetchrow(
            """
            SELECT id, email, password_hash, created_at
            FROM users
            WHERE email = $1;
            """,
            email,
        )

    return dict(row) if row else None


async def get_user_by_id(
    user_id: UUID,
) -> dict[str, Any] | None:
    """Retrieve a user by ID without exposing the password hash."""

    async with get_connection() as connection:
        row = await connection.fetchrow(
            """
            SELECT id, email, created_at
            FROM users
            WHERE id = $1;
            """,
            user_id,
        )

    return dict(row) if row else None


# --------------------------------------------------
# Analysis Queries
# --------------------------------------------------

async def create_analysis(
    analysis_id: UUID,
    user_id: UUID,
    region: str,
) -> dict[str, Any]:
    """Create a new analysis record."""

    async with get_connection() as connection:
        row = await connection.fetchrow(
            """
            INSERT INTO analyses (
                id,
                user_id,
                region,
                status
            )
            VALUES ($1, $2, $3, 'in_progress')
            RETURNING *;
            """,
            analysis_id,
            user_id,
            region,
        )

    return dict(row)


async def update_analysis(
    analysis_id: UUID,
    user_id: UUID,
    *,
    status: str,
    resources_scanned: int = 0,
    issues_found: int = 0,
    estimated_savings: str = "",
    analysis_result: dict[str, Any] | None = None,
) -> None:
    """Update an analysis belonging to the specified user."""

    if status not in {
        "pending",
        "in_progress",
        "completed",
        "failed",
    }:
        raise ValueError("Invalid analysis status.")

    result = analysis_result if analysis_result is not None else {}

    async with get_connection() as connection:
        command_status = await connection.execute(
            """
            UPDATE analyses
            SET
                status = $3,
                resources_scanned = $4,
                issues_found = $5,
                estimated_savings = $6,
                analysis_result = $7::jsonb
            WHERE id = $1 AND user_id = $2;
            """,
            analysis_id,
            user_id,
            status,
            resources_scanned,
            issues_found,
            estimated_savings,
            json.dumps(result, default=str),
        )

    if command_status.endswith(" 0"):
        logger.warning(
            "No analysis record updated for analysis ID %s.",
            analysis_id,
        )


async def get_user_analyses(
    user_id: UUID,
    limit: int = 50,
    offset: int = 0,
) -> list[dict[str, Any]]:
    """Retrieve analysis history for a particular user."""

    async with get_connection() as connection:
        rows = await connection.fetch(
            """
            SELECT
                id,
                region,
                resources_scanned,
                issues_found,
                estimated_savings,
                analysis_result,
                status,
                created_at
            FROM analyses
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3;
            """,
            user_id,
            limit,
            offset,
        )

    records = []

    for row in rows:
        record = dict(row)

        record["analysis_result"] = _decode_analysis_result(
            record.get("analysis_result"),
            record.get("id"),
        )

        records.append(serialize_value(record))

    return records


async def get_user_analysis(
    analysis_id: UUID,
    user_id: UUID,
) -> dict[str, Any] | None:
    """Retrieve one analysis owned by the authenticated user."""
    async with get_connection() as connection:
        row = await connection.fetchrow(
            """
            SELECT id, region, resources_scanned, issues_found,
                   estimated_savings, analysis_result, status, created_at
            FROM analyses
            WHERE id = $1 AND user_id = $2;
            """,
            analysis_id,
            user_id,
        )

    if row is None:
        return None

    record = dict(row)
    record["analysis_result"] = _decode_analysis_result(
        record.get("analysis_result"), record.get("id")
    )
    return serialize_value(record)

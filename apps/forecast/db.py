"""PostgreSQL connection pool (asyncpg).

Reads DATABASE_URL from env. Falls back to SUPABASE_DB_URL / SUPABASE_DATABASE_URL
for compatibility with the Chonburi worker env pattern.
"""

import os
import asyncpg

_pool: asyncpg.Pool | None = None


def _db_url() -> str:
    for key in ("SUPABASE_DB_URL", "SUPABASE_DATABASE_URL", "DATABASE_URL"):
        url = os.environ.get(key)
        if url:
            return url
    raise RuntimeError(
        "No database URL found. Set DATABASE_URL or SUPABASE_DB_URL."
    )


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        url = _db_url()
        # asyncpg expects 'postgres://' not 'postgresql://'
        url = url.replace("postgresql://", "postgres://")
        _pool = await asyncpg.create_pool(
            url,
            min_size=1,
            max_size=4,
            ssl="require",
            statement_cache_size=0,  # required for Supabase PgBouncer
        )
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool:
        await _pool.close()
        _pool = None

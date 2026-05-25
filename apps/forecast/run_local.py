#!/usr/bin/env python3
"""Standalone forecast runner for local macOS deployment (launchd / M3).

No HTTP server — connects to the DB, runs TimesFM inference, writes forecasts,
then exits cleanly. launchd fires this script every hour via StartInterval=3600.

Usage:
    python run_local.py

Environment variables required (set in the launchd plist EnvironmentVariables):
    DATABASE_URL   — PostgreSQL connection string to Supabase
                     e.g. postgresql://postgres:PASSWORD@HOST.supabase.co:5432/postgres
"""

from __future__ import annotations

import asyncio
import logging
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("forecast.local")


async def main() -> None:
    from db import close_pool, get_pool
    from timesfm_runner import run_all_forecasts

    logger.info("=== Chonburi forecast run starting ===")
    pool = await get_pool()
    try:
        results = await run_all_forecasts(pool)
        ok = sum(1 for s in results.values() if s.startswith("ok"))
        logger.info("=== Done: %d/%d metrics written ===", ok, len(results))
        for metric, status in results.items():
            level = logging.INFO if status.startswith("ok") else logging.WARNING
            logger.log(level, "  %-35s → %s", metric, status)
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(main())

"""Chonburi Forecast Service — FastAPI + APScheduler.

Exposes:
  GET /health      → liveness + last run status
  POST /run        → trigger a forecast run immediately (for testing)

Cron: every hour via APScheduler (also configured in render.yaml).
"""

from __future__ import annotations

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from db import close_pool, get_pool
from timesfm_runner import run_all_forecasts

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("forecast.main")

_last_run: dict[str, Any] = {}


async def _do_run() -> None:
    global _last_run
    logger.info("Starting forecast run …")
    pool = await get_pool()
    results = await run_all_forecasts(pool)
    from datetime import datetime, timezone
    _last_run = {"ran_at": datetime.now(tz=timezone.utc).isoformat(), "results": results}
    logger.info("Forecast run complete: %s", results)


@asynccontextmanager
async def lifespan(app: FastAPI):  # type: ignore[type-arg]
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(_do_run, "cron", minute=0)   # top of every hour
    scheduler.start()
    # Run once at startup so we have data immediately
    asyncio.create_task(_do_run())
    yield
    scheduler.shutdown(wait=False)
    await close_pool()


app = FastAPI(title="Chonburi Forecast Service", lifespan=lifespan)


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "last_run": _last_run})


@app.post("/run")
async def trigger_run() -> JSONResponse:
    asyncio.create_task(_do_run())
    return JSONResponse({"status": "queued"})


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, log_level="info")

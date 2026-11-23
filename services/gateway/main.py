import asyncio
import os
import random
from contextlib import asynccontextmanager

import httpx
import redis.asyncio as aioredis
from fastapi import FastAPI, HTTPException

from common.logging import setup_logging
from common.metrics import setup_metrics
from common.tracing import setup_tracing

ORDERS_URL = os.getenv("ORDERS_URL", "http://orders:8000")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
BASE_RPS = float(os.getenv("BASE_RPS", "4"))
SPIKE_RPS = float(os.getenv("SPIKE_RPS", "40"))
CHAOS_DURATION = int(os.getenv("CHAOS_DURATION", "45"))
SCENARIOS = {"traffic", "errors", "latency"}

log = setup_logging("gateway")
r = aioredis.from_url(REDIS_URL, decode_responses=True)
_inflight: set[asyncio.Task] = set()


# ─────────── 1. Generador de tráfico ───────────

async def fire(client: httpx.AsyncClient) -> None:
    try:
        await client.post("/orders", params={"amount": round(random.uniform(5, 200), 2)})
    except httpx.HTTPError:
        pass  # el error ya queda registrado en métricas/logs/trazas de orders


async def current_rps() -> float:
    try:
        return SPIKE_RPS if await r.exists("chaos:traffic") else BASE_RPS
    except Exception:
        return BASE_RPS


async def loadgen(client: httpx.AsyncClient) -> None:
    while True:
        rps = await current_rps()
        # Lazo ABIERTO: lanzamos el request y NO esperamos la respuesta
        task = asyncio.create_task(fire(client))
        _inflight.add(task)
        task.add_done_callback(_inflight.discard)
        await asyncio.sleep(1 / rps)


@asynccontextmanager
async def lifespan(app: FastAPI):
    client = httpx.AsyncClient(base_url=ORDERS_URL, timeout=5.0)
    task = asyncio.create_task(loadgen(client))
    log.info("loadgen started", extra={"base_rps": BASE_RPS, "spike_rps": SPIKE_RPS})
    yield
    task.cancel()
    await client.aclose()


app = FastAPI(title="gateway", lifespan=lifespan)
setup_metrics(app, "gateway")
setup_tracing(app, "gateway")


# ─────────── 2. API de caos ───────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "gateway"}


@app.get("/api/chaos/status")
async def chaos_status():
    for scenario in SCENARIOS:
        ttl = await r.ttl(f"chaos:{scenario}")
        if ttl > 0:
            return {"active": scenario, "remaining": ttl}
    return {"active": None, "remaining": 0}


@app.post("/api/chaos/{scenario}")
async def trigger_chaos(scenario: str):
    if scenario not in SCENARIOS:
        raise HTTPException(status_code=404, detail="escenario desconocido")

    # Candado global: un solo escenario a la vez (SET ... NX = solo si no existe)
    acquired = await r.set("chaos:lock", scenario, nx=True, ex=CHAOS_DURATION)
    if not acquired:
        raise HTTPException(status_code=409, detail="ya hay un escenario activo")

    await r.set(f"chaos:{scenario}", "1", ex=CHAOS_DURATION)
    log.warning("chaos triggered", extra={"scenario": scenario, "duration_s": CHAOS_DURATION})
    return {"active": scenario, "remaining": CHAOS_DURATION}
import asyncio
import os
import random
import secrets
import time
from contextlib import asynccontextmanager

import httpx
import redis.asyncio as aioredis
from fastapi import Cookie, FastAPI, HTTPException, Request, Response

from common.logging import setup_logging
from common.metrics import setup_metrics
from common.tracing import setup_tracing

ORDERS_URL = os.getenv("ORDERS_URL", "http://orders:8000")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
BASE_RPS = float(os.getenv("BASE_RPS", "4"))
SPIKE_RPS = float(os.getenv("SPIKE_RPS", "40"))
CHAOS_DURATION = int(os.getenv("CHAOS_DURATION", "45"))
SCENARIOS = {"traffic", "errors", "latency"}

SESSION_TTL = int(os.getenv("SESSION_TTL", "1200"))         # 20 min por persona
MAX_SESSIONS = int(os.getenv("MAX_SESSIONS", "3"))          # máx. 3 a la vez
SESSION_COOLDOWN = int(os.getenv("SESSION_COOLDOWN", "0"))  # espera entre sesiones (por IP)

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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "gateway"}


# ─────────── 2. Sesiones ───────────

def client_ip(request: Request) -> str:
    # nginx nos pasa la IP real del visitante en este header
    return request.headers.get("x-real-ip") or request.client.host


async def session_remaining(sid: str | None) -> int:
    """Segundos que le quedan a una sesión (0 si no existe o venció)."""
    if not sid:
        return 0
    expires = await r.zscore("sessions", sid)
    return max(0, int(expires - time.time())) if expires else 0


@app.post("/api/session")
async def start_session(
    request: Request,
    response: Response,
    bmi_session: str | None = Cookie(default=None),
):
    now = time.time()

    # Si ya tiene una sesión activa, la reutiliza (recargar la página no gasta otra)
    remaining = await session_remaining(bmi_session)
    if remaining:
        return {"active": True, "remaining": remaining}

    # ¿Esta IP usó la demo hace poco?
    ip = client_ip(request)
    cooldown = await r.ttl(f"cooldown:{ip}")
    if cooldown > 0:
        raise HTTPException(status_code=429, detail={"reason": "cooldown", "retry_in": cooldown})

    # ¿Hay cupo? (primero limpiamos las sesiones vencidas)
    await r.zremrangebyscore("sessions", 0, now)
    if await r.zcard("sessions") >= MAX_SESSIONS:
        oldest = await r.zrange("sessions", 0, 0, withscores=True)
        retry_in = int(oldest[0][1] - now) if oldest else 60
        raise HTTPException(status_code=503, detail={"reason": "full", "retry_in": retry_in})

    # Crear la sesión
    sid = secrets.token_urlsafe(16)
    await r.zadd("sessions", {sid: now + SESSION_TTL})
    if SESSION_COOLDOWN > 0:
        await r.set(f"cooldown:{ip}", "1", ex=SESSION_COOLDOWN)

    response.set_cookie(
        "bmi_session", sid, max_age=SESSION_TTL, httponly=True, samesite="strict"
    )
    log.info("session started", extra={"active_sessions": await r.zcard("sessions")})
    return {"active": True, "remaining": SESSION_TTL}


@app.get("/api/session")
async def get_session(bmi_session: str | None = Cookie(default=None)):
    remaining = await session_remaining(bmi_session)
    return {"active": remaining > 0, "remaining": remaining}


# ─────────── 3. API de caos ───────────

@app.get("/api/chaos/status")
async def chaos_status():
    for scenario in SCENARIOS:
        ttl = await r.ttl(f"chaos:{scenario}")
        if ttl > 0:
            return {"active": scenario, "remaining": ttl}
    return {"active": None, "remaining": 0}


@app.post("/api/chaos/{scenario}")
async def trigger_chaos(scenario: str, bmi_session: str | None = Cookie(default=None)):
    if scenario not in SCENARIOS:
        raise HTTPException(status_code=404, detail="escenario desconocido")

    # Sin sesión no hay caos
    if not await session_remaining(bmi_session):
        raise HTTPException(status_code=401, detail="necesitas una sesión activa")

    # Candado global: un solo escenario a la vez (SET ... NX = solo si no existe)
    acquired = await r.set("chaos:lock", scenario, nx=True, ex=CHAOS_DURATION)
    if not acquired:
        raise HTTPException(status_code=409, detail="ya hay un escenario activo")

    await r.set(f"chaos:{scenario}", "1", ex=CHAOS_DURATION)
    log.warning("chaos triggered", extra={"scenario": scenario, "duration_s": CHAOS_DURATION})
    return {"active": scenario, "remaining": CHAOS_DURATION}
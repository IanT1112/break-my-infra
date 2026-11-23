import os
import random
import threading
import time

from fastapi import FastAPI, HTTPException

from common.chaos import is_active
from common.logging import setup_logging
from common.metrics import setup_metrics
from common.tracing import setup_tracing

POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "2"))
_db_pool = threading.BoundedSemaphore(POOL_SIZE)   # ← NUEVO: "conexiones" disponibles

log = setup_logging("payments")

app = FastAPI(title="payments")
setup_metrics(app, "payments")
setup_tracing(app, "payments")


@app.get("/health")
def health():
    return {"status": "ok", "service": "payments"}


@app.post("/pay")
def pay(amount: float = 10.0):
    # ← NUEVO: pedir una conexión; si no hay en 1.5 s, falla
    if not _db_pool.acquire(timeout=1.5):
        log.error("db pool exhausted", extra={"amount": amount, "pool_size": POOL_SIZE})
        raise HTTPException(status_code=503, detail="db pool exhausted")

    try:
        latency = random.uniform(0.02, 0.15)
        if is_active("latency"):
            latency += random.uniform(0.6, 1.2)
        time.sleep(latency)
        latency_ms = round(latency * 1000)

        error_rate = 0.30 if is_active("errors") else 0.02
        if random.random() < error_rate:
            log.error("payment failed", extra={"amount": amount, "error": "provider_timeout"})
            raise HTTPException(status_code=502, detail="payment provider error")

        log.info("payment ok", extra={"amount": amount, "latency_ms": latency_ms})
        return {"status": "paid", "amount": amount, "latency_ms": latency_ms}
    finally:
        _db_pool.release()   # ← NUEVO: SIEMPRE devolver la conexión
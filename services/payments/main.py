import random
import time

from fastapi import FastAPI, HTTPException

from common.chaos import is_active
from common.logging import setup_logging
from common.metrics import setup_metrics
from common.tracing import setup_tracing

log = setup_logging("payments")

app = FastAPI(title="payments")
setup_metrics(app, "payments")
setup_tracing(app, "payments")


@app.get("/health")
def health():
    return {"status": "ok", "service": "payments"}


@app.post("/pay")
def pay(amount: float = 10.0):
    latency = random.uniform(0.02, 0.15)
    if is_active("latency"):                      # 🐢 escenario: DB lenta
        latency += random.uniform(0.6, 1.2)
    time.sleep(latency)
    latency_ms = round(latency * 1000)

    error_rate = 0.30 if is_active("errors") else 0.02   # 💥 escenario: errores
    if random.random() < error_rate:
        log.error("payment failed", extra={"amount": amount, "error": "provider_timeout"})
        raise HTTPException(status_code=502, detail="payment provider error")

    log.info("payment ok", extra={"amount": amount, "latency_ms": latency_ms})
    return {"status": "paid", "amount": amount, "latency_ms": latency_ms}
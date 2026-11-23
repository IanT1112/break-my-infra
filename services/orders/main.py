import os
import random
import time

import httpx
from fastapi import FastAPI, HTTPException

from common.logging import setup_logging
from common.metrics import setup_metrics

PAYMENTS_URL = os.getenv("PAYMENTS_URL", "http://payments:8000")

log = setup_logging("orders")

app = FastAPI(title="orders")
setup_metrics(app, "orders")

client = httpx.Client(base_url=PAYMENTS_URL, timeout=2.0)


@app.get("/health")
def health():
    return {"status": "ok", "service": "orders"}


@app.post("/orders")
def create_order(amount: float = 25.0):
    order_id = f"ord_{random.randint(10000, 99999)}"

    time.sleep(random.uniform(0.005, 0.03))  # simula guardar en DB

    try:
        response = client.post("/pay", params={"amount": amount})
        response.raise_for_status()
    except httpx.HTTPError as exc:
        log.error(
            "order failed",
            extra={"order_id": order_id, "amount": amount, "reason": str(exc)},
        )
        raise HTTPException(status_code=502, detail="payment failed")

    log.info("order created", extra={"order_id": order_id, "amount": amount})
    return {"order_id": order_id, "status": "created", "payment": response.json()}
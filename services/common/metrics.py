import time

from fastapi import FastAPI, Request, Response
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

REQUESTS = Counter(
    "bmi_requests_total",
    "Total de requests HTTP",
    ["service", "route", "status"],
)
LATENCY = Histogram(
    "bmi_request_duration_seconds",
    "Latencia de requests HTTP",
    ["service", "route"],
    buckets=(0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5),
)


def setup_metrics(app: FastAPI, service: str) -> None:
    @app.get("/metrics", include_in_schema=False)
    def metrics():
        return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next):
        if request.url.path == "/metrics":
            return await call_next(request)

        start = time.perf_counter()
        status = 500
        try:
            response = await call_next(request)
            status = response.status_code
            return response
        finally:
            route = request.scope.get("route")
            path = route.path if route else "unmatched"
            REQUESTS.labels(service, path, str(status)).inc()
            LATENCY.labels(service, path).observe(time.perf_counter() - start)
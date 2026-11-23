from fastapi import FastAPI
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor


def setup_tracing(app: FastAPI, service: str) -> None:
    provider = TracerProvider(resource=Resource.create({"service.name": service}))

    # El endpoint lo lee de la variable OTEL_EXPORTER_OTLP_ENDPOINT
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)

    # Spans automáticos para requests entrantes (sin ruido de health/metrics)
    FastAPIInstrumentor.instrument_app(app, excluded_urls="health,metrics")

    # Spans automáticos + propagación del trace_id en llamadas salientes
    HTTPXClientInstrumentor().instrument()
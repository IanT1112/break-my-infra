import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import boto3

ec2 = boto3.client("ec2")
ssm = boto3.client("ssm")

INSTANCE_ID = os.environ["INSTANCE_ID"]
MAX_STARTS_PER_DAY = int(os.environ.get("MAX_STARTS_PER_DAY", "3"))
LANDING = (Path(__file__).parent / "landing.html").read_text(encoding="utf-8")


def respond(status, body):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def instance_info():
    inst = ec2.describe_instances(InstanceIds=[INSTANCE_ID])["Reservations"][0]["Instances"][0]
    return inst["State"]["Name"], inst.get("PublicIpAddress")


def app_ready(ip):
    """¿El panel ya responde?"""
    try:
        with urllib.request.urlopen(f"http://{ip}/api/chaos/status", timeout=2) as r:
            return r.status == 200
    except Exception:
        return False


def starts_today():
    """Cuántas veces se encendió hoy (contador en SSM Parameter Store, gratis)."""
    name = f"/break-my-infra/starts/{datetime.now(timezone.utc):%Y-%m-%d}"
    try:
        return name, int(ssm.get_parameter(Name=name)["Parameter"]["Value"])
    except ssm.exceptions.ParameterNotFound:
        return name, 0


def handler(event, context):
    method = event["requestContext"]["http"]["method"]
    path = event["rawPath"]

    if path == "/" and method == "GET":
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "text/html; charset=utf-8"},
            "body": LANDING,
        }

    if path == "/status" and method == "GET":
        state, ip = instance_info()
        ready = state == "running" and ip is not None and app_ready(ip)
        return respond(200, {"state": state, "ready": ready, "url": f"http://{ip}" if ready else None})

    if path == "/start" and method == "POST":
        state, _ = instance_info()
        if state in ("running", "pending"):
            return respond(200, {"state": state})
        if state != "stopped":
            return respond(409, {"state": state, "detail": "el servidor se está apagando, intenta en 1 min"})

        name, count = starts_today()
        if count >= MAX_STARTS_PER_DAY:
            return respond(429, {"detail": "límite diario alcanzado, vuelve mañana"})

        ec2.start_instances(InstanceIds=[INSTANCE_ID])
        ssm.put_parameter(Name=name, Value=str(count + 1), Type="String", Overwrite=True)
        return respond(202, {"state": "pending"})

    return respond(404, {"detail": "not found"})
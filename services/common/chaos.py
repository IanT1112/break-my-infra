import os

import redis

_redis = redis.Redis.from_url(
    os.getenv("REDIS_URL", "redis://redis:6379/0"),
    decode_responses=True,
    socket_timeout=0.2,
)


def is_active(scenario: str) -> bool:
    """¿Está activo este escenario de caos?"""
    try:
        return _redis.exists(f"chaos:{scenario}") == 1
    except redis.RedisError:
        # Si Redis se cae, la app sigue funcionando normal (fail-open)
        return False
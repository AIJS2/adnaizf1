from __future__ import annotations

import logging
import os

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

# Reverse proxies whose forwarded headers are trusted. Empty means "keep the
# legacy behaviour" (honour X-Real-IP / X-Forwarded-For from any peer), which
# is fine for local dev but spoofable if the API port is ever exposed directly.
_TRUSTED_PROXIES = frozenset(
    p.strip() for p in os.getenv("TRUSTED_PROXIES", "").split(",") if p.strip()
)


def get_real_client_ip(request: Request) -> str:
    """Resolve client IP from reverse-proxy headers, falling back to socket peer."""
    peer = get_remote_address(request)

    # Only trust the spoofable forwarded headers when the immediate peer is a
    # known proxy (or no allowlist is configured, for backward compatibility).
    if _TRUSTED_PROXIES and peer not in _TRUSTED_PROXIES:
        return peer

    real_ip = request.headers.get("X-Real-IP", "").strip()
    if real_ip:
        return real_ip
    forwarded_for = request.headers.get("X-Forwarded-For", "").strip()
    if forwarded_for:
        first_ip = forwarded_for.split(",")[0].strip()
        if first_ip:
            return first_ip
    return peer

# ---------------------------------------------------------------------------
# Rate limiting configuration
#
# Two constraints drive this setup:
#
# 1. slowapi/limits provide NO async Redis backend (limits.storage exposes only
#    synchronous variants), and slowapi evaluates each limit with a synchronous
#    `limiter.hit(...)` call INSIDE the async ASGI middleware. An
#    asyncio.to_thread wrapper is therefore impossible from inside slowapi (it
#    never awaits the storage). Instead we bound the cost of each synchronous
#    Redis round-trip with a connection pool and short socket timeouts
#    (_STORAGE_OPTIONS below). On loopback Redis this is a sub-millisecond hit;
#    if Redis is unreachable, slowapi's storage-dead detection fails OPEN to an
#    in-memory limiter instead of blocking the event loop indefinitely.
#
# 2. Redis storage is REQUIRED for limits to hold across multiple Uvicorn
#    workers. In-memory storage is per-process and trivially bypassed by
#    round-robining workers, so we only fall back to memory when no REDIS_URL
#    is configured (local dev), and we log a loud warning in that case.
# ---------------------------------------------------------------------------
_redis_url = os.getenv("REDIS_URL", "").strip()

_storage_uri = _redis_url or "memory://"
if not _redis_url and os.getenv("ENVIRONMENT") not in ("test", "testing"):
    logger.warning(
        "REDIS_URL not set - rate limiting using in-memory storage. "
        "Limits are per-worker and will NOT hold under multiple Uvicorn "
        "workers. Set REDIS_URL in production."
    )

# Passed straight through to redis.Redis(**options) by limits.storage. The
# slowapi type stub annotates storage_options as Dict[str, str], but the real
# runtime signature accepts float | str | bool (verified against
# limits.storage.storage_from_string / RedisStorage.__init__). The values below
# are all valid redis-py client kwargs.
_STORAGE_OPTIONS = {
    # Short timeouts so a slow/unreachable Redis can't stall the event loop.
    "socket_connect_timeout": float(os.getenv("REDIS_CONNECT_TIMEOUT", "1")),
    "socket_timeout": float(os.getenv("REDIS_SOCKET_TIMEOUT", "1")),
    "socket_keepalive": True,
    "health_check_interval": 30,
    # Bounded pool so a burst can't open unbounded sockets.
    "max_connections": int(os.getenv("REDIS_MAX_CONNECTIONS", "50")),
}

limiter = Limiter(
    key_func=get_real_client_ip,
    # Every endpoint is capped even if it forgets a decorator.
    default_limits=[os.getenv("DEFAULT_RATE_LIMIT", "200/minute")],
    storage_uri=_storage_uri,
    storage_options=_STORAGE_OPTIONS,  # type: ignore[arg-type]  # stub says Dict[str,str]; runtime accepts float|bool|int
    enabled=True,
)

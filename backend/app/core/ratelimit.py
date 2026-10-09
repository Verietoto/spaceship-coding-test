"""Rate limits kept in memory: a sliding window per key, and a cap on requests running at once.

A request over its limit gets HTTP 429 with Retry-After. The limits are settings (core/config.py), read when a request
arrives, so they can be changed without touching code.
ponytail: counters live in this process; if the app ever runs as several processes, move them to Redis.
"""
import threading
import time
from collections import deque
from contextlib import contextmanager
from typing import Any

from fastapi import Depends, HTTPException

from . import config
from .security import SessionUser, current_user

SLOT_TTL = 300  # seconds: a slot nobody released (a dropped connection) frees itself
SWEEP_AT = 5000  # keys: past this, windows that expired are forgotten so random emails or IPs cannot grow the memory


def _too_many(retry: int) -> HTTPException:
    return HTTPException(429, f"Too many requests. Try again in {retry} seconds.", headers={"Retry-After": str(retry)})


class Limiter:
    def __init__(self) -> None:
        self._hits: dict[str, tuple[deque[float], float]] = {}  # key -> (times of the hits in the window, window seconds)
        self._slots: dict[str, list[float]] = {}  # key -> when each running request started
        self._lock = threading.Lock()

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
            self._slots.clear()

    def _window(self, key: str, window: float, now: float) -> deque[float]:
        times, _ = self._hits.get(key, (deque(), window))
        while times and times[0] <= now - window:
            times.popleft()
        self._hits[key] = (times, window)
        if len(self._hits) > SWEEP_AT:
            self._hits = {k: v for k, v in self._hits.items() if v[0] and v[0][-1] > now - v[1]}
        return times

    def blocked(self, key: str, limit: int, window: float, now: float | None = None) -> None:
        """Raise 429 when `key` already has `limit` hits in the window (nothing is counted)."""
        t = time.monotonic() if now is None else now
        with self._lock:
            times = self._window(key, window, t)
            if len(times) >= limit:
                raise _too_many(max(1, int(times[0] + window - t) + 1))

    def add(self, key: str, window: float, now: float | None = None) -> None:
        t = time.monotonic() if now is None else now
        with self._lock:
            self._window(key, window, t).append(t)

    def hit(self, key: str, limit: int, window: float, now: float | None = None) -> None:
        """Count one request under `key`, or raise 429 when the window is full."""
        t = time.monotonic() if now is None else now
        with self._lock:
            times = self._window(key, window, t)
            if len(times) >= limit:
                raise _too_many(max(1, int(times[0] + window - t) + 1))
            times.append(t)

    def clear(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)

    def acquire(self, key: str, limit: int, now: float | None = None) -> None:
        """Take one of `limit` slots for requests running at once (429 when all are taken); give it back with `release`."""
        t = time.monotonic() if now is None else now
        with self._lock:
            running = [s for s in self._slots.get(key, []) if s > t - SLOT_TTL]
            if len(running) >= limit:
                raise _too_many(5)
            self._slots[key] = [*running, t]

    def release(self, key: str) -> None:
        with self._lock:
            running = self._slots.get(key, [])
            if running:
                running.pop(0)

    @contextmanager
    def slot(self, key: str, setting: str) -> Any:
        self.acquire(key, getattr(config, setting))
        try:
            yield
        finally:
            self.release(key)


limiter = Limiter()


def per_user(scope: str, setting: str, window: float) -> Any:
    """A dependency: at most config.<setting> requests per `window` seconds for the logged-in user."""

    def check(user: SessionUser = Depends(current_user)) -> None:
        limiter.hit(f"{scope}:{user.id}", getattr(config, setting), window)

    return Depends(check)


def client_ip(request: Any) -> str:
    """The caller's address. Behind a reverse proxy this is the proxy's, so all users would share one budget:
    run uvicorn with --proxy-headers (and --forwarded-allow-ips) so Starlette reads X-Forwarded-For."""
    return request.client.host if request.client else "unknown"

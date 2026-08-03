"""In-process TTL cache (Phase 16).

A simple LRU+TTL cache that avoids hammering free OpenStreetMap /
Overpass / OpenWeather endpoints. Designed to be importable without any
extra packages — pure stdlib. Use:

    from app.services.cache import TTLCache
    cache = TTLCache(maxsize=512, ttl_seconds=180)

    value = cache.get(key)
    if value is None:
        value = expensive_call()
        cache.set(key, value)
"""
from __future__ import annotations

import time
from collections import OrderedDict
from threading import RLock
from typing import Any, Optional


class TTLCache:
    def __init__(self, maxsize: int = 256, ttl_seconds: float = 180) -> None:
        self._maxsize = maxsize
        self._ttl = ttl_seconds
        self._data: "OrderedDict[str, tuple[float, Any]]" = OrderedDict()
        self._lock = RLock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._data.get(key)
            if not entry:
                return None
            ts, value = entry
            if (time.monotonic() - ts) > self._ttl:
                self._data.pop(key, None)
                return None
            self._data.move_to_end(key)
            return value

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._data[key] = (time.monotonic(), value)
            self._data.move_to_end(key)
            while len(self._data) > self._maxsize:
                self._data.popitem(last=False)

    def invalidate(self, prefix: str) -> int:
        """Drop every key starting with `prefix` — useful when the user
        submits feedback and we want to refresh related caches."""
        with self._lock:
            removed = 0
            for key in list(self._data.keys()):
                if key.startswith(prefix):
                    self._data.pop(key, None)
                    removed += 1
            return removed

    def stats(self) -> dict[str, Any]:
        with self._lock:
            return {"size": len(self._data), "maxsize": self._maxsize,
                    "ttl_seconds": self._ttl}


# Shared caches for the most hammered read-only endpoints. Memory-only,
# process-local — sufficient to flatten OutageMap spikes for one backend.
weather_cache  = TTLCache(maxsize=256, ttl_seconds=600)   # 10 min
geocode_cache  = TTLCache(maxsize=512, ttl_seconds=24 * 3600)  # 1 day
nearby_cache   = TTLCache(maxsize=256, ttl_seconds=900)   # 15 min
budget_cache   = TTLCache(maxsize=256, ttl_seconds=300)   # 5 min
safety_cache   = TTLCache(maxsize=128, ttl_seconds=60 * 60)

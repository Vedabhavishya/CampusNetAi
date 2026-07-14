from collections import deque
import threading
import time

class TelemetryCache:
    """
    Thread-safe and async-safe in-memory cache for network device telemetry status.
    """
    def __init__(self):
        self._cache = {}
        self._history = {} # {device_id: deque(maxlen=10)}
        self._lock = threading.Lock()

    def add_history(self, device_id: str, entry: dict):
        with self._lock:
            if device_id not in self._history:
                self._history[device_id] = deque(maxlen=10)
            self._history[device_id].append(entry)

    def get_history(self, device_id: str) -> list:
        with self._lock:
            return list(self._history.get(device_id, []))

    def set(self, device_id: str, data: dict):
        with self._lock:
            self._cache[device_id] = {
                "data": data,
                "timestamp": time.time()
            }

    def get(self, device_id: str) -> dict:
        with self._lock:
            entry = self._cache.get(device_id)
            if entry:
                return entry["data"]
            return None

    def get_with_timestamp(self, device_id: str) -> dict:
        with self._lock:
            return self._cache.get(device_id)

    def clear(self):
        with self._lock:
            self._cache.clear()

telemetry_cache = TelemetryCache()

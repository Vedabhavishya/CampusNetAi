import socket
import threading
import queue

class AsyncDNSResolver:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if not cls._instance:
                cls._instance = super(AsyncDNSResolver, cls).__new__(cls, *args, **kwargs)
                cls._instance._init_resolver()
            return cls._instance

    def _init_resolver(self):
        self.cache = {
            "8.8.8.8": "dns.google",
            "8.8.4.4": "dns.google",
            "1.1.1.1": "one.one.one.one",
            "192.168.30.100": "Veda-Bhavishya-M34",
            "192.168.30.104": "POCO-X4-Pro-5G",
            "192.168.30.102": "V2240",
            "192.168.1.1": "srx300-fw",
            "192.168.99.2": "ex4100-router",
            "192.168.99.3": "ex2300-switch"
        }
        self.queue = queue.Queue()
        self.worker = threading.Thread(target=self._resolve_loop, daemon=True)
        self.worker.start()

    def resolve(self, ip: str) -> str:
        """
        Lookup in cache. If not found, queue it for background resolution and return the IP itself.
        """
        if not ip:
            return ""
        if ip in self.cache:
            return self.cache[ip]
        
        # Queue it to resolve in the background
        self.queue.put(ip)
        # Seed cache temporarily with IP to prevent queue duplication
        self.cache[ip] = ip
        return ip

    def _resolve_loop(self):
        while True:
            ip = self.queue.get()
            try:
                # Do a standard socket reverse lookup
                host = socket.getnameinfo((ip, 0), socket.NI_NAMEREQD)[0]
                self.cache[ip] = host
            except Exception:
                # Fallback to keep IP
                self.cache[ip] = ip
            finally:
                self.queue.task_done()

import random

class MockApCollector:
    def collect_status(self, ip_address: str, mac_address: str, config: dict = None, *args, **kwargs) -> dict:
        is_offline = "22" in ip_address
        return {
            "status": "offline" if is_offline else "online",
            "health_score": 0 if is_offline else random.randint(90, 99),
            "cpu_usage": 0 if is_offline else random.randint(10, 40),
            "memory_usage": 0 if is_offline else random.randint(20, 35),
            "uptime": "0 mins" if is_offline else "30 days, 10 hours",
            "model": "Juniper Standalone AP (Mock)",
            "version": "AP-OS 1.2.3",
            "telemetry": {
                "radios": {
                    "2.4GHz": {"channel": 6, "tx_power_dbm": 12, "active_clients": 6},
                    "5GHz": {"channel": 36, "tx_power_dbm": 15, "active_clients": 12}
                }
            }
        }

    def push_configuration(self, ip_address: str, config: dict, credentials: dict = None) -> bool:
        print(f"[MockApCollector] Pushing configuration to {ip_address}: {config}", flush=True)
        return True

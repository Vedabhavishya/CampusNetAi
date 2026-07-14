import random

class MockCoreSwitchCollector:
    def collect_status(self, ip_address: str, mac_address: str, config: dict = None, *args, **kwargs) -> dict:
        return {
            "status": "online",
            "health_score": 99,
            "cpu_usage": random.randint(5, 12),
            "memory_usage": 42,
            "uptime": "142 days, 2 hours",
            "model": "Juniper EX4400-24T (Mock)",
            "version": "JunOS 22.4R1.10",
            "telemetry": {
                "virtual_chassis_members": 2,
                "stp_root_role": True,
                "lag_groups": {
                    "ae0": {"status": "up", "speed": "20Gbps", "active_members": ["xe-0/0/0", "xe-0/0/1"]},
                    "ae1": {"status": "up", "speed": "20Gbps", "active_members": ["xe-0/1/0", "xe-1/1/0"]}
                }
            }
        }

    def push_configuration(self, ip_address: str, config: dict, credentials: dict = None) -> bool:
        print(f"[MockCoreSwitchCollector] Pushing configuration to {ip_address}: {config}", flush=True)
        return True


class MockAccessSwitchCollector:
    def collect_status(self, ip_address: str, mac_address: str, config: dict = None, *args, **kwargs) -> dict:
        poe_watts = random.randint(90, 130)
        return {
            "status": "online",
            "health_score": 95 if "10" in ip_address else 82,
            "cpu_usage": random.randint(18, 30) if "10" in ip_address else random.randint(70, 85),
            "memory_usage": 51 if "10" in ip_address else 62,
            "uptime": "30 days, 12 hours" if "10" in ip_address else "15 days, 4 hours",
            "model": "Juniper EX2300-48P (Mock)",
            "version": "JunOS 21.2R3.5",
            "telemetry": {
                "poe_budget_watts": 370,
                "poe_consumption_watts": poe_watts,
                "loop_detected_ports": ["ge-0/0/4"] if "11" in ip_address else []
            }
        }

    def push_configuration(self, ip_address: str, config: dict, credentials: dict = None) -> bool:
        print(f"[MockAccessSwitchCollector] Pushing configuration to {ip_address}: {config}", flush=True)
        return True

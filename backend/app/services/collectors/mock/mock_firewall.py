import random
import time

class MockFirewallCollector:
    """
    Simulates a high-fidelity firewall for development/demonstration mode.
    """
    def collect_status(self, ip_address: str, mac_address: str, config: dict = None) -> dict:
        return {
            "status": "online",
            "health_score": 98,
            "cpu_usage": random.randint(12, 18),
            "memory_usage": 35,
            "uptime": "45 days, 8 hours",
            "model": "Juniper SRX300 (Mock)",
            "version": "JunOS 21.4R3-S3.4",
            "temperature": 38,
            "telemetry": {
                "hostname": "CN-FW-01-BORDER",
                "active_sessions": random.randint(1200, 1600),
                "packet_loss_percentage": 0.0,
                "interfaces": [
                    {"interface": "ge-0/0/0.0", "admin": "up", "link": "up", "ip": "203.0.113.2"},
                    {"interface": "ge-0/0/1.0", "admin": "up", "link": "up", "ip": "10.10.10.1"},
                    {"interface": "ge-0/0/2.0", "admin": "up", "link": "up", "ip": "10.10.20.1"}
                ],
                "routes": [
                    {"destination": "0.0.0.0/0", "gateway": "203.0.113.1", "interface": "ge-0/0/0.0"},
                    {"destination": "10.10.10.0/24", "gateway": "Direct", "interface": "ge-0/0/1.0"},
                    {"destination": "10.10.20.0/24", "gateway": "Direct", "interface": "ge-0/0/2.0"}
                ],
                "zones": [
                    {"zone": "trust", "interfaces": ["ge-0/0/1.0", "ge-0/0/2.0"]},
                    {"zone": "untrust", "interfaces": ["ge-0/0/0.0"]}
                ],
                "policies": [
                    {"fromZone": "trust", "toZone": "untrust", "policyName": "Allow-Web", "state": "enabled"},
                    {"fromZone": "untrust", "toZone": "trust", "policyName": "Block-All", "state": "enabled"}
                ]
            }
        }
        
    def push_configuration(self, ip_address: str, config: dict, credentials: dict = None) -> bool:
        print(f"[MockFirewallCollector] Pushing configuration to {ip_address}: {config}", flush=True)
        return True

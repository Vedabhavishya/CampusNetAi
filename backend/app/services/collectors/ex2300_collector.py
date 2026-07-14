import os
import time
import logging
from .ex4100_collector import EX4100Collector
from .parsers.ex2300_parser import EX2300Parser
from .mock.mock_switch import MockAccessSwitchCollector
from .commands import EX2300_COMMANDS
from .telemetry_cache import telemetry_cache

logger = logging.getLogger("EX2300Collector")

class EX2300Collector(EX4100Collector):
    """
    EX2300 Access Switch Collector.
    Inherits robust connection, polling, metrics, and caching workflows from EX4100Collector,
    and isolates EX2300-specific command keys, parsing, and mock models.
    """
    def __init__(self):
        super().__init__()
        self.name = "EX2300"
        self.parser = EX2300Parser()
        self.commands = EX2300_COMMANDS
        self.mock_collector = MockAccessSwitchCollector()
        self.device_id = "dev-as-1" # Default fallback device ID

    def connect(self, host: str = None) -> bool:
        if not host:
            host = os.getenv("EX2300_HOST", "10.10.10.10")
        try:
            port = int(os.getenv("EX2300_PORT", "22"))
        except ValueError:
            port = 22
        username = os.getenv("EX2300_USERNAME", "root")
        password = os.getenv("EX2300_PASSWORD", "Juniper@1234")
        
        try:
            return self.ssh_manager.connect(host, port, username, password)
        except Exception as e:
            logger.error(f"[Collector][EX2300] SSH Connection failed: {e}")
            return False

    def collect_status(self, ip_address: str, mac_address: str, config: dict = None, device_id: str = None) -> dict:
        if device_id:
            self.device_id = device_id
        return self.collect(ip_address)

    def get_mock_telemetry(self, host: str, start_time: float, mock_data: dict, history_list: list) -> dict:
        poll_timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        poll_duration_ms = int((time.time() - start_time) * 1000)
        
        model = mock_data.get("model", "Juniper EX2300-48P")
        port_count = 48
        if "12" in model:
            port_count = 12
        elif "24" in model:
            port_count = 24
            
        interfaces = []
        members = []
        for idx in range(port_count):
            ifname = f"ge-0/0/{idx}"
            interfaces.append({
                "interface": ifname,
                "admin": "up" if idx < (port_count // 2) else "down",
                "link": "up" if idx < (port_count // 2) else "down",
                "ip": "N/A",
                "protocol": "eth-switch"
            })
            members.append(ifname)
            
        # Add uplinks
        interfaces.extend([
            {"interface": "xe-0/0/0", "admin": "up", "link": "up", "ip": "N/A", "protocol": "eth-switch"},
            {"interface": "xe-0/0/1", "admin": "up", "link": "up", "ip": "N/A", "protocol": "eth-switch"}
        ])
        members.extend(["xe-0/0/0", "xe-0/0/1"])

        hostname = "ex2300 switch" if "10" in host else "CN-AS-02-FLOOR2"

        return {
            "status": "online",
            "health_score": mock_data["health_score"],
            "cpu_usage": mock_data["cpu_usage"],
            "memory_usage": mock_data["memory_usage"],
            "uptime": mock_data["uptime"],
            "model": mock_data["model"],
            "version": mock_data["version"],
            "temperature": 39,
            "telemetry": {
                "hostname": hostname,
                "interfaces": interfaces,
                "routes": [],
                "zones": [],
                "policies": [],
                "vlans": [
                    {"name": "default", "id": 1, "members": members, "member_count": len(members)}
                ],
                "mac_table": [
                    {"mac_address": "00:0b:82:33:c5:10", "vlan": "default", "interface": "ge-0/0/0", "type": "Dynamic", "age": "-"}
                ],
                "lldp_neighbors": [
                    {"local_interface": "ge-0/0/0", "neighbor_hostname": "ex4100 router", "neighbor_interface": "ge-0/0/2", "neighbor_chassis_id": "00:15:5d:83:b2:1a"}
                ],
                "port_statistics": {
                    "ports": {
                        ifname: {"speed": "1000 Mbps" if "ge" in ifname else "10 Gbps"}
                        for ifname in members
                    },
                    "aggregate": {"total_rx": 2100, "total_tx": 3400, "switch_throughput_bps": 5200, "average_utilization": 0.005}
                },
                "metrics": {
                    "cpu": {"user": 3, "kernel": 1, "idle": 96},
                    "memory": {"total": 2048, "used": 1024, "usage": 50},
                    "temperature": {"system": 35, "cpu": 39},
                    "interfaces": {"total": len(interfaces), "up": port_count // 2 + 2, "down": port_count // 2, "physical": len(interfaces), "logical": 0},
                    "traffic": {"total_rx_bytes": 2100, "total_tx_bytes": 3400, "switch_throughput_bps": 5200, "average_utilization": 0.005},
                    "errors": {"input_errors": 0, "output_errors": 0, "drops": 0, "crc_errors": 0}
                },
                "performance": {
                    "current": {
                        "ssh_latency_ms": 0,
                        "poll_duration_ms": poll_duration_ms,
                        "total_bytes_received": 0,
                        "commands_executed": 0,
                        "commands_failed": 0,
                        "commands": []
                    },
                    "history": history_list
                }
            },
            "raw": {},
            "collector": {
                "name": "EX2300Collector",
                "version": "1.0.0",
                "vendor": "Juniper",
                "device_family": "EX",
                "last_poll": poll_timestamp,
                "poll_duration_ms": poll_duration_ms,
                "commands_executed": 0,
                "commands_failed": 0
            },
            "inventory": {
                "device_id": self.device_id,
                "hostname": hostname,
                "vendor": "Juniper",
                "family": "EX",
                "model": mock_data["model"],
                "serial": "CV3324AX0240",
                "management_ip": host,
                "software_version": mock_data["version"],
                "hardware_revision": "REV 01",
                "uptime": mock_data["uptime"]
            },
            "health": {
                "connected": False,
                "status": "online",
                "health_score": mock_data["health_score"],
                "last_seen": poll_timestamp,
                "last_successful_poll": poll_timestamp,
                "ssh_latency_ms": 0,
                "poll_duration_ms": poll_duration_ms,
                "command_failures": 0
            }
        }

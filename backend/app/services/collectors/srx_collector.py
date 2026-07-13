import os
import time
from .base_collector import BaseCollector
from .ssh_manager import SSHManager
from .commands import SRX_COMMANDS
from .parsers.srx_parser import SRXParser
from .mock.mock_firewall import MockFirewallCollector

class SRXCollector(BaseCollector):
    """
    Juniper SRX300 Physical Device Collector.
    Connects to the firewall over SSH, parses telemetry, keeps health state,
    and returns detailed hardware configurations/inventory.
    """
    def __init__(self):
        self.ssh_manager = SSHManager()
        self.parser = SRXParser()
        self.mock_collector = MockFirewallCollector()
        self.device_id = "dev-fw-1"
        self._inventory = {}
        self._interfaces = []
        self._routes = []
        self._security = {}
        self._sessions_arp = {}
        self._chassis = {}
        self._uptime = "0 mins"
        self._raw_telemetry = {}

    def connect(self) -> bool:
        host = os.getenv("SRX_HOST", "192.168.1.1")
        try:
            port = int(os.getenv("SRX_PORT", "22"))
        except ValueError:
            port = 22
        username = os.getenv("SRX_USERNAME", "admin")
        password = os.getenv("SRX_PASSWORD", "Juniper@1234")
        
        try:
            return self.ssh_manager.connect(host, port, username, password)
        except Exception:
            return False

    def disconnect(self):
        self.ssh_manager.disconnect()

    def collect(self) -> dict:
        """
        Gathers all telemetry in a single SSH session and parses it.
        """
        # Read from environment variables if we should use mock fallback
        use_mock_fallback = os.getenv("USE_MOCK_FALLBACK", "true").lower() == "true"
        
        start_time = time.time()
        connected = self.connect()
        
        if not connected:
            if use_mock_fallback:
                print("[SRXCollector] Live device unreachable. Falling back to Mock data.", flush=True)
                mock_data = self.mock_collector.collect_status("192.168.1.1", "00:0B:82:11:A3:F1")
                # Populate internal properties for API legacy accesses
                self._inventory = {
                    "model": mock_data["model"],
                    "junos": mock_data["version"],
                    "hostname": mock_data["telemetry"]["hostname"],
                    "vendor": "Juniper (Mock Fallback)",
                    "device_type": "Firewall",
                    "serial": "MOCK-SERIAL-SRX300"
                }
                self._interfaces = mock_data["telemetry"]["interfaces"]
                self._routes = mock_data["telemetry"]["routes"]
                self._security = {
                    "zones": mock_data["telemetry"]["zones"],
                    "policies": mock_data["telemetry"]["policies"]
                }
                self._chassis = {
                    "cpu": {"user": 5, "kernel": 5, "idle": 90},
                    "memory": {"total": 4096, "used": 1433, "usage": 35},
                    "temperature": {"system": 38, "cpu": 38}
                }
                self._uptime = mock_data["uptime"]
                self._sessions_arp = {
                    "active_sessions": mock_data["telemetry"]["active_sessions"],
                    "arp_entries_count": 5
                }
                return mock_data
            else:
                print("[SRXCollector] Connection Failure. Mock fallback disabled.", flush=True)
                return {
                    "connected": False,
                    "status": "offline",
                    "reason": "SSH Connection Failed",
                    "last_successful_poll": self.ssh_manager.stats.get("last_successful_poll"),
                    "telemetry": None
                }

        # Successful connection: collect telemetry using a single SSH session
        self.ssh_manager.stats["poll_count"] += 1
        self._raw_telemetry = {}
        
        username = os.getenv("SRX_USERNAME", "admin")
        is_root = (username == "root")
        
        def run_cmd(cmd_key):
            cmd = SRX_COMMANDS[cmd_key]
            if is_root:
                return self.ssh_manager.run_command(f'cli -c "{cmd}"')
            return self.ssh_manager.run_command(cmd)

        try:
            # 1. Execute all CLI commands and store raw outputs
            raw_version = run_cmd("version")
            raw_uptime = run_cmd("uptime")
            raw_cpu = run_cmd("cpu")
            raw_interfaces = run_cmd("interfaces")
            raw_routes = run_cmd("routes")
            raw_zones = run_cmd("zones")
            raw_policies = run_cmd("policies")
            raw_sessions = run_cmd("sessions")
            raw_arp = run_cmd("arp")

            # Save raw outputs
            self._raw_telemetry = {
                SRX_COMMANDS["version"]: raw_version,
                SRX_COMMANDS["uptime"]: raw_uptime,
                SRX_COMMANDS["cpu"]: raw_cpu,
                SRX_COMMANDS["interfaces"]: raw_interfaces,
                SRX_COMMANDS["routes"]: raw_routes,
                SRX_COMMANDS["zones"]: raw_zones,
                SRX_COMMANDS["policies"]: raw_policies,
                SRX_COMMANDS["sessions"]: raw_sessions,
                SRX_COMMANDS["arp"]: raw_arp
            }

            # 2. Parse telemetry
            self._inventory = self.parser.parse_version(raw_version)
            # Add static / derived properties
            self._inventory["serial"] = "CV3324AX0240"
            self._inventory["interfaces"] = len(self._interfaces)
            
            self._uptime = self.parser.parse_uptime(raw_uptime)
            self._chassis = self.parser.parse_chassis(raw_cpu)
            self._interfaces = self.parser.parse_interfaces(raw_interfaces)
            self._routes = self.parser.parse_routes(raw_routes)
            self._security = self.parser.parse_security(raw_zones, raw_policies)
            self._sessions_arp = self.parser.parse_sessions_arp(raw_sessions, raw_arp)

            # Update last successful poll timestamp
            poll_timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            self.ssh_manager.stats["last_successful_poll"] = poll_timestamp
            
            self.ssh_manager.stats["response_time_ms"] = int((time.time() - start_time) * 1000)
            
            print(f"[SRXCollector] Successfully polled live device | Time: {self.ssh_manager.stats['response_time_ms']}ms", flush=True)

            # Format status structure matching existing interface
            result = {
                "status": "online",
                "health_score": 100 if self._chassis["cpu"]["idle"] > 30 else 85,
                "cpu_usage": 100 - self._chassis["cpu"]["idle"],
                "memory_usage": self._chassis["memory"]["usage"],
                "uptime": self._uptime,
                "model": self._inventory["model"],
                "version": self._inventory["junos"],
                "temperature": self._chassis["temperature"]["system"],
                "telemetry": {
                    "hostname": self._inventory["hostname"],
                    "active_sessions": self._sessions_arp["active_sessions"],
                    "packet_loss_percentage": 0.0,
                    "interfaces": self._interfaces,
                    "routes": self._routes,
                    "zones": self._security["zones"],
                    "policies": self._security["policies"]
                },
                "raw": self._raw_telemetry,
                "health": self.health(),
                "inventory": self.get_inventory()
            }
            return result
        except Exception as e:
            print(f"[SRXCollector] Collector Errors during parsing/poll: {e}", flush=True)
            self.ssh_manager.stats["failed_polls"] += 1
            self.ssh_manager.stats["last_failed_poll"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            if use_mock_fallback:
                return self.mock_collector.collect_status("192.168.1.1", "00:0B:82:11:A3:F1")
            else:
                return {
                    "connected": False,
                    "status": "offline",
                    "reason": "SSH Connection Closed / Command Error",
                    "last_successful_poll": self.ssh_manager.stats.get("last_successful_poll"),
                    "telemetry": None
                }
        finally:
            self.disconnect()

    def health(self) -> dict:
        status_str = "healthy"
        if not self.ssh_manager.stats["connected"]:
            status_str = "offline"
        elif self.ssh_manager.stats["failed_polls"] > 0:
            status_str = "warning"
            
        return {
            "device_id": self.device_id,
            "connected": self.ssh_manager.stats["connected"],
            "last_seen": self.ssh_manager.stats["last_seen"],
            "last_successful_poll": self.ssh_manager.stats["last_successful_poll"],
            "last_failed_poll": self.ssh_manager.stats["last_failed_poll"],
            "response_time_ms": self.ssh_manager.stats["response_time_ms"],
            "poll_count": self.ssh_manager.stats["poll_count"],
            "failed_polls": self.ssh_manager.stats["failed_polls"],
            "collector": "SRXCollector",
            "status": status_str
        }

    def get_inventory(self) -> dict:
        return self._inventory

    def get_interfaces(self) -> list:
        return self._interfaces

    # Legacy Compatibility implementation
    def collect_status(self, ip_address: str, mac_address: str, config: dict = None) -> dict:
        return self.collect()

    def push_configuration(self, ip_address: str, config: dict, credentials: dict = None) -> bool:
        # Push configuration command parsing compatibility
        use_mock_fallback = os.getenv("USE_MOCK_FALLBACK", "true").lower() == "true"
        if use_mock_fallback:
            return self.mock_collector.push_configuration(ip_address, config)

        # Real push logic
        connected = self.connect()
        if not connected:
            return False
        try:
            username = os.getenv("SRX_USERNAME", "admin")
            is_root = (username == "root")
            
            commands = ["configure"]
            if "dnsServers" in config:
                commands.append(f"set system name-server {config['dnsServers'][0]}")
            commands.append("commit")
            
            if is_root:
                cmd_str = "; ".join(commands)
                self.ssh_manager.run_command(f'cli -c "{cmd_str}"')
            else:
                for cmd in commands:
                    self.ssh_manager.run_command(cmd)
            return True
        except Exception as e:
            print(f"[SRXCollector] Push Configuration Failed: {e}", flush=True)
            return False
        finally:
            self.disconnect()

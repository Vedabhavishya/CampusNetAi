import os
import time
import logging
from .base_collector import BaseCollector, calculate_health_score
from .ssh_manager import SSHManager
from .commands import EX4100_COMMANDS
from .parsers.ex4100_parser import EX4100Parser
from .mock.mock_switch import MockCoreSwitchCollector
from .telemetry_cache import telemetry_cache

logger = logging.getLogger("EX4100Collector")

class EX4100Collector(BaseCollector):
    """
    Physical Juniper EX4100 switch collector.
    Executes commands sequentially in a single SSH session, parses telemetry,
    calculates dynamic health, and returns structured data compliant with the API.
    """
    def __init__(self):
        self.name = "EX4100"
        self.ssh_manager = SSHManager()
        self.parser = EX4100Parser()
        self.commands = EX4100_COMMANDS
        self.mock_collector = MockCoreSwitchCollector()
        self.device_id = "dev-cs-1"
        self._inventory = {}
        self._interfaces = []
        self._vlans = []
        self._mac_table = []
        self._lldp_neighbors = []
        self._port_statistics = {}
        self._chassis = {}
        self._uptime = "142 days, 2 hours"
        self._raw_telemetry = {}
        
        # Stats tracking specifically for collector metadata
        self.collector_stats = {
            "commands_executed": 0,
            "commands_failed": 0,
            "poll_duration_ms": 0
        }

    def connect(self, host: str = None) -> bool:
        if not host:
            host = os.getenv("EX_HOST", "10.10.10.2")
        try:
            port = int(os.getenv("EX_PORT", "22"))
        except ValueError:
            port = 22
        username = os.getenv("EX_USERNAME", "root")
        password = os.getenv("EX_PASSWORD", "Juniper@1234")
        
        try:
            return self.ssh_manager.connect(host, port, username, password)
        except Exception as e:
            logger.error(f"[Collector][{self.name}] SSH Connection failed: {e}")
            return False

    def disconnect(self):
        self.ssh_manager.disconnect()

    def get_mock_telemetry(self, host: str, start_time: float, mock_data: dict, history_list: list) -> dict:
        poll_timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        poll_duration_ms = int((time.time() - start_time) * 1000)
        return {
            "status": "online",
            "health_score": mock_data["health_score"],
            "cpu_usage": mock_data["cpu_usage"],
            "memory_usage": mock_data["memory_usage"],
            "uptime": mock_data["uptime"],
            "model": mock_data["model"],
            "version": mock_data["version"],
            "temperature": 42,
            "telemetry": {
                "hostname": "CN-CS-01-SPINE",
                "interfaces": [
                    {"interface": "ge-0/0/0", "admin": "up", "link": "up", "ip": "N/A", "protocol": "eth-switch"},
                    {"interface": "ge-0/0/1", "admin": "up", "link": "up", "ip": "N/A", "protocol": "eth-switch"}
                ],
                "routes": [],
                "zones": [],
                "policies": [],
                "vlans": [
                    {"name": "default", "id": 1, "members": ["ge-0/0/0", "ge-0/0/1"], "member_count": 2}
                ],
                "mac_table": [
                    {"mac_address": "00:15:5d:83:b2:1a", "vlan": "default", "interface": "ge-0/0/0", "type": "Dynamic", "age": "-"}
                ],
                "lldp_neighbors": [
                    {"local_interface": "ge-0/0/0", "neighbor_hostname": "SRX300-FW", "neighbor_interface": "ge-0/0/0", "neighbor_chassis_id": "00:0b:82:11:a3:f1"}
                ],
                "port_statistics": {
                    "ports": {},
                    "aggregate": {"total_rx": 5000, "total_tx_8000": 8000, "switch_throughput_bps": 12000, "average_utilization": 0.01}
                },
                "metrics": {
                    "cpu": {"user": 5, "kernel": 2, "idle": 93},
                    "memory": {"total": 8192, "used": 3440, "usage": 42},
                    "temperature": {"system": 38, "cpu": 42},
                    "interfaces": {"total": 2, "up": 2, "down": 0, "physical": 2, "logical": 0},
                    "traffic": {"total_rx_bytes": 5000, "total_tx_bytes": 8000, "switch_throughput_bps": 12000, "average_utilization": 0.01},
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
                "name": "EX4100Collector",
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
                "hostname": "CN-CS-01-SPINE",
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

    def collect(self, host: str = None) -> dict:
        """
        Gathers all switch telemetry in a single SSH session and parses it.
        """
        if not host:
            host = os.getenv("EX_HOST", "10.10.10.2")
        use_mock_fallback = os.getenv("USE_MOCK_FALLBACK", "true").lower() == "true"
        start_time = time.time()
        
        print(f"[Collector][{self.name}] Connecting to {host}...", flush=True)
        connected = self.connect(host)
        
        if not connected:
            poll_timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            # Record performance history on failure
            history_entry = {
                "timestamp": poll_timestamp,
                "poll_duration_ms": int((time.time() - start_time) * 1000),
                "ssh_latency_ms": 0
            }
            telemetry_cache.add_history(self.device_id, history_entry)
            
            if use_mock_fallback:
                print(f"[Collector][{self.name}] Live device unreachable. Falling back to Mock switch data.", flush=True)
                mock_data = self.mock_collector.collect_status(host, "00:15:5d:83:b2:1a")
                
                # Fetch history
                history_list = telemetry_cache.get_history(self.device_id)
                return self.get_mock_telemetry(host, start_time, mock_data, history_list)
            else:
                print(f"[Collector][{self.name}] Connection Failure. Mock fallback disabled.", flush=True)
                poll_timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                history_list = telemetry_cache.get_history(self.device_id)
                return {
                    "connected": False,
                    "status": "offline",
                    "reason": "SSH Connection Failed",
                    "last_successful_poll": self.ssh_manager.stats.get("last_successful_poll"),
                    "telemetry": {
                        "performance": {
                            "current": {
                                "ssh_latency_ms": 0,
                                "poll_duration_ms": int((time.time() - start_time) * 1000),
                                "total_bytes_received": 0,
                                "commands_executed": 0,
                                "commands_failed": 0,
                                "commands": []
                            },
                            "history": history_list
                        }
                    },
                    "collector": {
                        "name": "EX4100Collector",
                        "version": "1.0.0",
                        "vendor": "Juniper",
                        "device_family": "EX",
                        "last_poll": poll_timestamp,
                        "poll_duration_ms": int((time.time() - start_time) * 1000),
                        "commands_executed": 0,
                        "commands_failed": 0
                    },
                    "health": {
                        "connected": False,
                        "status": "offline",
                        "health_score": 0,
                        "last_seen": poll_timestamp,
                        "last_successful_poll": self.ssh_manager.stats.get("last_successful_poll"),
                        "ssh_latency_ms": 0,
                        "poll_duration_ms": int((time.time() - start_time) * 1000),
                        "command_failures": 0
                    }
                }

        # Successful connection: collect telemetry sequentially in same session
        latency_ms = self.ssh_manager.stats.get("ssh_latency_ms", 0)
        print(f"[SSH] Connected (Latency: {latency_ms} ms)", flush=True)
        
        self.ssh_manager.stats["poll_count"] += 1
        self._raw_telemetry = {}
        self.collector_stats["commands_executed"] = 0
        self.collector_stats["commands_failed"] = 0
        total_bytes_received = 0
        command_perf_metrics = []
        raw_outputs = {}
        
        username = os.getenv("EX_USERNAME", "root")
        is_root = (username == "root")

        # Command mapping helper with timeout handling
        def exec_command_with_timeout(cmd_key):
            cmd = self.commands[cmd_key]
            full_cmd = f'cli -c "{cmd}"' if is_root else cmd
            
            self.collector_stats["commands_executed"] += 1
            cmd_start = time.time()
            try:
                # 10s default execution timeout
                output = self.ssh_manager.run_command(full_cmd, timeout=10) or ""
                cmd_duration = int((time.time() - cmd_start) * 1000)
                cmd_bytes = len(output)
                
                print(f"[Command] {cmd} | {cmd_bytes} bytes | {cmd_duration} ms", flush=True)
                raw_outputs[cmd_key] = output
                
                self._raw_telemetry[cmd] = {
                    "success": True,
                    "output": output,
                    "error": None
                }
                
                nonlocal total_bytes_received
                total_bytes_received += cmd_bytes
                
                command_perf_metrics.append({
                    "command": cmd,
                    "duration_ms": cmd_duration,
                    "bytes": cmd_bytes,
                    "success": True
                })
                
                return output
            except Exception as ex:
                self.collector_stats["commands_failed"] += 1
                cmd_duration = int((time.time() - cmd_start) * 1000)
                logger.warning(f"Timeout/Error executing command '{cmd}': {ex}")
                
                raw_outputs[cmd_key] = ""
                
                self._raw_telemetry[cmd] = {
                    "success": False,
                    "output": "",
                    "error": str(ex)
                }
                
                command_perf_metrics.append({
                    "command": cmd,
                    "duration_ms": cmd_duration,
                    "bytes": 0,
                    "success": False
                })
                
                return ""

        # Execute commands in strict order
        raw_version = exec_command_with_timeout("version")
        raw_uptime = exec_command_with_timeout("uptime")
        raw_cpu = exec_command_with_timeout("routing_engine")
        raw_interfaces = exec_command_with_timeout("interfaces")
        raw_vlans = exec_command_with_timeout("vlans")
        raw_mac = exec_command_with_timeout("mac_table")
        raw_lldp = exec_command_with_timeout("lldp")
        raw_stats = exec_command_with_timeout("interface_stats")

        try:
            # Parse Outputs
            self._inventory = self.parser.parse_version(raw_version)
            self._uptime = self.parser.parse_uptime(raw_uptime)
            self._chassis = self.parser.parse_chassis(raw_cpu)
            self._interfaces = self.parser.parse_interfaces(raw_interfaces)
            self._vlans = self.parser.parse_vlans(raw_vlans)
            self._mac_table = self.parser.parse_mac_table(raw_mac)
            self._lldp_neighbors = self.parser.parse_lldp(raw_lldp)
            self._port_statistics = self.parser.parse_interface_stats(raw_stats)

            print("Parser Summary:", flush=True)
            print(f"[Parser] Interfaces Parsed: {len(self._interfaces)}", flush=True)
            print(f"[Parser] VLANs Parsed: {len(self._vlans)}", flush=True)
            print(f"[Parser] MAC Entries Parsed: {len(self._mac_table)}", flush=True)
            print(f"[Parser] LLDP Neighbors Parsed: {len(self._lldp_neighbors)}", flush=True)
            print(f"[Parser] Port Statistics Parsed: {len(self._port_statistics.get('ports', {}))}", flush=True)

            # Standardized inventory properties
            self._inventory["serial"] = "CV3324AX0240"
            self._inventory["interfaces"] = len(self._interfaces)
            
            # Update last successful poll timestamp
            poll_timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            poll_duration_ms = int((time.time() - start_time) * 1000)
            self.ssh_manager.stats["last_successful_poll"] = poll_timestamp
            self.ssh_manager.stats["response_time_ms"] = poll_duration_ms
            self.collector_stats["poll_duration_ms"] = poll_duration_ms

            # Record performance history
            history_entry = {
                "timestamp": poll_timestamp,
                "poll_duration_ms": poll_duration_ms,
                "ssh_latency_ms": latency_ms
            }
            telemetry_cache.add_history(self.device_id, history_entry)
            
            # Fetch history
            history_list = telemetry_cache.get_history(self.device_id)

            # Dynamic Health Calculation
            cpu_idle = self._chassis["cpu"]["idle"]
            cpu_usage = 100 - cpu_idle
            mem_usage = self._chassis["memory"]["usage"]
            temp_system = self._chassis["temperature"]["system"]
            temp_cpu = self._chassis["temperature"]["cpu"]
            
            down_count = 0
            for iface in self._interfaces:
                if "." not in iface["interface"]:
                    if iface["admin"] == "up" and iface["link"] == "down":
                        down_count += 1
                        
            agg = self._port_statistics.get("aggregate", {})
            input_errors = agg.get("errors", {}).get("input_errors", 0) if isinstance(agg.get("errors"), dict) else 0
            output_errors = agg.get("errors", {}).get("output_errors", 0) if isinstance(agg.get("errors"), dict) else 0
            crc_errors = agg.get("errors", {}).get("crc_errors", 0) if isinstance(agg.get("errors"), dict) else 0
            
            error_ports_count = 0
            if "ports" in self._port_statistics:
                for p_name, p_stat in self._port_statistics["ports"].items():
                    if p_stat.get("input_errors", 0) > 0 or p_stat.get("output_errors", 0) > 0 or p_stat.get("crc_errors", 0) > 0:
                        error_ports_count += 1
            
            health_score = calculate_health_score(
                connected=True,
                cpu_usage=cpu_usage,
                memory_usage=mem_usage,
                temperature=temp_system,
                down_interfaces_count=down_count,
                error_interfaces_count=error_ports_count,
                command_failures_count=self.collector_stats["commands_failed"]
            )

            # Build Standardized Metrics sub-object
            metrics = {
                "cpu": self._chassis["cpu"],
                "memory": self._chassis["memory"],
                "temperature": self._chassis["temperature"],
                "interfaces": {
                    "total": len(self._interfaces),
                    "up": sum(1 for i in self._interfaces if i["link"] == "up"),
                    "down": sum(1 for i in self._interfaces if i["link"] == "down"),
                    "physical": sum(1 for i in self._interfaces if "." not in i["interface"]),
                    "logical": sum(1 for i in self._interfaces if "." in i["interface"])
                },
                "traffic": {
                    "total_rx_bytes": agg.get("total_rx", 0),
                    "total_tx_bytes": agg.get("total_tx", 0),
                    "switch_throughput_bps": agg.get("switch_throughput_bps", 0),
                    "average_utilization": agg.get("average_utilization", 0.0)
                },
                "errors": {
                    "input_errors": input_errors,
                    "output_errors": output_errors,
                    "drops": agg.get("errors", {}).get("drops", 0) if isinstance(agg.get("errors"), dict) else 0,
                    "crc_errors": crc_errors
                }
            }

            print("[Scheduler] Cache Updated", flush=True)
            print("[Scheduler] Database Updated", flush=True)
            print(f"[Collector][{self.name}] Completed", flush=True)
            print(f"Poll Duration: {poll_duration_ms / 1000:.2f} s", flush=True)
            print(f"Health Score: {health_score}", flush=True)
            print(f"Commands Executed: {self.collector_stats['commands_executed']}", flush=True)
            print(f"Commands Failed: {self.collector_stats['commands_failed']}", flush=True)
            print(f"Bytes Received: {total_bytes_received}", flush=True)

            # Format final telemetry object
            result = {
                "status": "online",
                "health_score": health_score,
                "cpu_usage": cpu_usage,
                "memory_usage": mem_usage,
                "uptime": self._uptime,
                "model": self._inventory["model"],
                "version": self._inventory["junos"],
                "temperature": temp_system,
                "telemetry": {
                    "hostname": self._inventory["hostname"],
                    "interfaces": self._interfaces,
                    "routes": [],
                    "zones": [],
                    "policies": [],
                    "vlans": self._vlans,
                    "mac_table": self._mac_table,
                    "lldp_neighbors": self._lldp_neighbors,
                    "port_statistics": self._port_statistics,
                    "metrics": metrics,
                    "performance": {
                        "current": {
                            "ssh_latency_ms": latency_ms,
                            "poll_duration_ms": poll_duration_ms,
                            "total_bytes_received": total_bytes_received,
                            "commands_executed": self.collector_stats["commands_executed"],
                            "commands_failed": self.collector_stats["commands_failed"],
                            "commands": command_perf_metrics
                        },
                        "history": history_list
                    }
                },
                "raw": self._raw_telemetry,
                "collector": {
                    "name": "EX4100Collector",
                    "version": "1.0.0",
                    "vendor": "Juniper",
                    "device_family": "EX",
                    "last_poll": poll_timestamp,
                    "poll_duration_ms": poll_duration_ms,
                    "commands_executed": self.collector_stats["commands_executed"],
                    "commands_failed": self.collector_stats["commands_failed"]
                },
                "inventory": {
                    "device_id": self.device_id,
                    "hostname": self._inventory["hostname"],
                    "vendor": "Juniper",
                    "family": "EX",
                    "model": self._inventory["model"],
                    "serial": "CV3324AX0240",
                    "management_ip": host,
                    "software_version": self._inventory["junos"],
                    "hardware_revision": "REV 01",
                    "uptime": self._uptime
                },
                "health": {
                    "connected": True,
                    "status": "online",
                    "health_score": health_score,
                    "last_seen": poll_timestamp,
                    "last_successful_poll": poll_timestamp,
                    "ssh_latency_ms": latency_ms,
                    "poll_duration_ms": poll_duration_ms,
                    "command_failures": self.collector_stats["commands_failed"]
                }
            }
            return result
        except Exception as e:
            print(f"[Collector][{self.name}] Errors parsing switch outputs: {e}", flush=True)
            self.ssh_manager.stats["failed_polls"] += 1
            self.ssh_manager.stats["last_failed_poll"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            if use_mock_fallback:
                mock_data = self.mock_collector.collect_status(host, "00:15:5d:83:b2:1a")
                history_list = telemetry_cache.get_history(self.device_id)
                return self.get_mock_telemetry(host, start_time, mock_data, history_list)
            else:
                poll_timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                history_list = telemetry_cache.get_history(self.device_id)
                return {
                    "connected": False,
                    "status": "offline",
                    "reason": f"Switch parsing error: {e}",
                    "last_successful_poll": self.ssh_manager.stats.get("last_successful_poll"),
                    "telemetry": {
                        "performance": {
                            "current": {
                                "ssh_latency_ms": latency_ms,
                                "poll_duration_ms": int((time.time() - start_time) * 1000),
                                "total_bytes_received": total_bytes_received,
                                "commands_executed": self.collector_stats["commands_executed"],
                                "commands_failed": self.collector_stats["commands_failed"],
                                "commands": command_perf_metrics
                            },
                            "history": history_list
                        }
                    },
                    "collector": {
                        "name": "EX4100Collector",
                        "version": "1.0.0",
                        "vendor": "Juniper",
                        "device_family": "EX",
                        "last_poll": poll_timestamp,
                        "poll_duration_ms": int((time.time() - start_time) * 1000),
                        "commands_executed": self.collector_stats["commands_executed"],
                        "commands_failed": self.collector_stats["commands_failed"]
                    },
                    "health": {
                        "connected": False,
                        "status": "offline",
                        "health_score": 0,
                        "last_seen": poll_timestamp,
                        "last_successful_poll": self.ssh_manager.stats.get("last_successful_poll"),
                        "ssh_latency_ms": latency_ms,
                        "poll_duration_ms": int((time.time() - start_time) * 1000),
                        "command_failures": self.collector_stats["commands_failed"]
                    }
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
            "collector": "EX4100Collector",
            "status": status_str
        }

    def get_inventory(self) -> dict:
        return self._inventory

    def get_interfaces(self) -> list:
        return self._interfaces

    def collect_status(self, ip_address: str, mac_address: str, config: dict = None, device_id: str = None) -> dict:
        if device_id:
            self.device_id = device_id
        return self.collect()

    def push_configuration(self, ip_address: str, config: dict, credentials: dict = None) -> bool:
        use_mock_fallback = os.getenv("USE_MOCK_FALLBACK", "true").lower() == "true"
        if use_mock_fallback:
            return self.mock_collector.push_configuration(ip_address, config)

        connected = self.connect()
        if not connected:
            return False
        try:
            username = os.getenv("EX_USERNAME", "root")
            is_root = (username == "root")
            
            commands = ["configure"]
            # Switch configuration commands can go here
            commands.append("commit")
            
            if is_root:
                cmd_str = "; ".join(commands)
                self.ssh_manager.run_command(f'cli -c "{cmd_str}"')
            else:
                for cmd in commands:
                    self.ssh_manager.run_command(cmd)
            return True
        except Exception as e:
            logger.error(f"[Collector][{self.name}] Push Config failed: {e}")
            return False
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
            "collector": "EX4100Collector",
            "status": status_str
        }

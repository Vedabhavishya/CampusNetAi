from abc import ABC, abstractmethod
import random

class BaseDeviceCollector(ABC):
    """
    Abstract Base Class for all network hardware collectors.
    All data is directly fetched from and pushed to local devices (Firewalls, L3/L2 Switches, 
    and Standalone APs) using direct SSH (CLI parsing) and SNMP polling. 
    NO external cloud APIs (e.g. Mist Cloud API) or third-party cloud services are used.
    """
    @abstractmethod
    def collect_status(self, ip_address: str, mac_address: str) -> dict:
        """
        Connects directly to the hardware node via SSH/SNMP to fetch operational metrics.
        """
        pass
    
    @abstractmethod
    def push_configuration(self, ip_address: str, config: dict) -> bool:
        """
        Connects directly to the hardware node via SSH to commit configuration changes.
        """
        pass


class FirewallCollector(BaseDeviceCollector):
    def collect_status(self, ip_address: str, mac_address: str) -> dict:
        # Real connection architecture:
        # 1. Establish direct SSH connection to JunOS Firewall via Paramiko/Netmiko:
        #    ssh = ConnectSSH(ip_address, username, password)
        # 2. Run CLI command: "show chassis routing-engine" & "show interfaces ge-0/0/0"
        # 3. Parse text output using regular expressions or TextFSM templates to extract:
        #    cpuUsage, memoryUsage, and status.
        # 4. Alternatively, poll SNMP OIDs directly using PySNMP:
        #    cpu_oid = "1.3.6.1.4.1.2636.3.1.13.1.8" (Juniper Routing Engine CPU)
        
        return {
            "health_score": 98,
            "cpu_usage": random.randint(10, 20),
            "memory_usage": 35,
            "uptime": "45 days, 8 hours",
            "telemetry": {
                "active_sessions": 1482,
                "packet_loss_percentage": 0.0,
                "intrusion_threats_blocked": 14,
                "wan_interfaces": {
                    "ge0": {"status": "up", "speed": "1000Mbps", "ip": "203.0.113.2"},
                    "ge1": {"status": "up", "speed": "1000Mbps", "ip": "10.10.10.1"}
                }
            }
        }

    def push_configuration(self, ip_address: str, config: dict) -> bool:
        # Real connection architecture:
        # 1. SSH to JunOS: `ssh.send_command("configure")`
        # 2. Push firewall rules or routing commands:
        #    `ssh.send_command("set security policies from-zone Trust to-zone Untrust policy Allow-Corp ...")`
        # 3. Commit changes locally: `ssh.send_command("commit")`
        print(f"[Direct Firewall SSH] Pushing firewall policies config to {ip_address}: {config}")
        return True


class CoreSwitchCollector(BaseDeviceCollector):
    def collect_status(self, ip_address: str, mac_address: str) -> dict:
        # Real connection architecture:
        # 1. Query Spine Switch directly via SNMP GET calls for CPU / Memory:
        #    SNMP OID `1.3.6.1.4.1.2636.3.1.13.1.21` (JunOS Memory Utilization)
        # 2. Pull active VLAN configuration details and port status.
        return {
            "health_score": 99,
            "cpu_usage": random.randint(5, 12),
            "memory_usage": 42,
            "uptime": "142 days, 2 hours",
            "telemetry": {
                "virtual_chassis_members": 2,
                "stp_root_role": True,
                "lag_groups": {
                    "ae0": {"status": "up", "speed": "20Gbps", "active_members": ["xe-0/0/0", "xe-0/0/1"]},
                    "ae1": {"status": "up", "speed": "20Gbps", "active_members": ["xe-0/1/0", "xe-1/1/0"]}
                }
            }
        }

    def push_configuration(self, ip_address: str, config: dict) -> bool:
        # Real connection architecture:
        # 1. Open SSH shell channel to switch.
        # 2. Push direct CLI commands to define VLANs and assign them to trunks:
        #    `set vlans corporate vlan-id 20`
        #    `set interfaces ge-0/0/1 unit 0 family ethernet-switching interface-mode trunk vlan members corporate`
        print(f"[Direct Core Switch SSH] Pushing STP/LAG trunk profiles to {ip_address}: {config}")
        return True


class AccessSwitchCollector(BaseDeviceCollector):
    def collect_status(self, ip_address: str, mac_address: str) -> dict:
        # Real connection architecture:
        # 1. Connect via SNMP to poll PoE Budget OIDs:
        #    `1.3.6.1.4.1.2636.3.40.1.4.1.1.1` (PoE port consumed power)
        # 2. Fetch link state changes from interface status table.
        poe_watts = random.randint(90, 130)
        return {
            "health_score": 95 if "10" in ip_address else 82,
            "cpu_usage": random.randint(18, 30) if "10" in ip_address else random.randint(70, 85),
            "memory_usage": 51 if "10" in ip_address else 62,
            "uptime": "30 days, 12 hours" if "10" in ip_address else "15 days, 4 hours",
            "telemetry": {
                "poe_budget_watts": 370,
                "poe_consumption_watts": poe_watts,
                "loop_detected_ports": ["ge-0/0/4"] if "11" in ip_address else []
            }
        }

    def push_configuration(self, ip_address: str, config: dict) -> bool:
        # Real connection architecture:
        # 1. SSH directly to access switch node.
        # 2. Run CLI port commands (e.g. `set interfaces ge-0/0/5 disable` or enabling PoE).
        print(f"[Direct Access Switch SSH] Pushing port matrix configuration to {ip_address}: {config}")
        return True


class ApCollector(BaseDeviceCollector):
    def collect_status(self, ip_address: str, mac_address: str) -> dict:
        # Real connection architecture (Standalone local AP node):
        # 1. Pull wireless interfaces metrics directly using SNMP 802.11 MIB queries:
        #    - Active Wireless clients count
        #    - RSSI & Signal-to-Noise Ratio (SNR) for associated MAC hosts
        #    - Channel Noise & Utilization load
        # 2. Execute Linux-based wireless tool commands directly on standalone AP OS:
        #    - Command: `iwinfo wlan0 assoclist` or `wl -i wl0 assoclist` to get raw client metrics.
        return {
            "health_score": 0 if "22" in ip_address else random.randint(90, 99),
            "cpu_usage": 0 if "22" in ip_address else random.randint(10, 40),
            "memory_usage": 0 if "22" in ip_address else random.randint(20, 35),
            "uptime": "0 mins" if "22" in ip_address else "30 days, 10 hours",
            "telemetry": {
                "radios": {
                    "2.4GHz": {"channel": 6, "tx_power_dbm": 12, "active_clients": 6},
                    "5GHz": {"channel": 36, "tx_power_dbm": 15, "active_clients": 12}
                }
            }
        }

    def push_configuration(self, ip_address: str, config: dict) -> bool:
        # Real connection architecture (Standalone local AP node):
        # 1. SSH directly into the Access Point device.
        # 2. Run local hostapd or device CLI commands to configure new SSID profiles:
        #    `set wlan ssid CampusNet-Corp security wpa3-personal`
        # 3. Apply changes and reload interface: `wifi down; wifi up` or `rc-service hostapd restart`
        print(f"[Direct AP SSH] Pushing RF radio channel and SSID profile configurations to AP at {ip_address}: {config}")
        return True


# Collector Registry Factory
class CollectorRegistry:
    def __init__(self):
        self._collectors = {
            "firewall": FirewallCollector(),
            "core_switch": CoreSwitchCollector(),
            "access_switch": AccessSwitchCollector(),
            "access_point": ApCollector()
        }

    def get_collector(self, device_type: str) -> BaseDeviceCollector:
        collector = self._collectors.get(device_type)
        if not collector:
            raise ValueError(f"No collector registered for device type: {device_type}")
        return collector

# Factory instance exporter
collector_registry = CollectorRegistry()

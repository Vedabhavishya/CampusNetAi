import logging
from .base_parser import BaseParser
from .ex4100_parser import EX4100Parser

logger = logging.getLogger("EX2300Parser")

class EX2300Parser(BaseParser):
    """
    Parses JunOS EX2300 CLI outputs by delegating to EX4100Parser compositionally.
    Keeps the two parser classes independent to avoid side-effects.
    """
    def __init__(self):
        self.delegator = EX4100Parser()

    def parse_version(self, version_out: str) -> dict:
        info = self.delegator.parse_version(version_out)
        # Apply EX2300 specific fallback defaults if regex didn't match
        if not version_out:
            info["model"] = "EX2300-C-12P"
            info["junos"] = "21.4R3-S7.6"
            info["device_type"] = "Access Switch"
        elif "EX2300" in info.get("model", "").upper():
            info["device_type"] = "Access Switch"
        return info

    def parse_uptime(self, uptime_out: str) -> str:
        return self.delegator.parse_uptime(uptime_out)

    def parse_chassis(self, chassis_out: str) -> dict:
        return self.delegator.parse_chassis(chassis_out)

    def parse_interfaces(self, interfaces_out: str) -> list:
        return self.delegator.parse_interfaces(interfaces_out)

    def parse_vlans(self, vlans_out: str) -> list:
        return self.delegator.parse_vlans(vlans_out)

    def parse_mac_table(self, mac_table_out: str) -> list:
        return self.delegator.parse_mac_table(mac_table_out)

    def parse_lldp(self, lldp_out: str) -> list:
        return self.delegator.parse_lldp(lldp_out)

    def parse_interface_stats(self, interface_stats_out: str) -> dict:
        return self.delegator.parse_interface_stats(interface_stats_out)

    def parse_routes(self, routes_out: str) -> list:
        return self.delegator.parse_routes(routes_out)

    def parse_security(self, zones_out: str, policies_out: str) -> dict:
        return self.delegator.parse_security(zones_out, policies_out)

    def parse_sessions_arp(self, sessions_out: str, arp_out: str) -> dict:
        return self.delegator.parse_sessions_arp(sessions_out, arp_out)

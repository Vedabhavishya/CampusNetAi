from abc import ABC, abstractmethod

class BaseParser(ABC):
    """
    Abstract Base Class for CLI parsers.
    Ensures all vendor-specific parsers implement consistent interfaces.
    """
    @abstractmethod
    def parse_version(self, version_out: str) -> dict:
        pass

    @abstractmethod
    def parse_uptime(self, uptime_out: str) -> str:
        pass

    @abstractmethod
    def parse_chassis(self, chassis_out: str) -> dict:
        pass

    @abstractmethod
    def parse_interfaces(self, interfaces_out: str) -> list:
        pass

    @abstractmethod
    def parse_routes(self, routes_out: str) -> list:
        pass

    @abstractmethod
    def parse_security(self, zones_out: str, policies_out: str) -> dict:
        pass

    @abstractmethod
    def parse_sessions_arp(self, sessions_out: str, arp_out: str) -> dict:
        pass

    @abstractmethod
    def parse_vlans(self, vlans_out: str) -> list:
        pass

    @abstractmethod
    def parse_mac_table(self, mac_table_out: str) -> list:
        pass

    @abstractmethod
    def parse_lldp(self, lldp_out: str) -> list:
        pass

    @abstractmethod
    def parse_interface_stats(self, interface_stats_out: str) -> dict:
        pass

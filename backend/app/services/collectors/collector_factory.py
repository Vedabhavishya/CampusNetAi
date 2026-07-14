from .base_collector import BaseDeviceCollector
from .srx_collector import SRXCollector
from .ex4100_collector import EX4100Collector
from .ex2300_collector import EX2300Collector
from .mock.mock_switch import MockCoreSwitchCollector, MockAccessSwitchCollector
from .mock.mock_ap import MockApCollector

class CollectorRegistry:
    """
    Vendor-agnostic factory mapping device types to physical or mock collectors.
    """
    def __init__(self):
        self._collectors = {
            "firewall": SRXCollector(),
            "core_switch": EX4100Collector(),
            "access_switch": EX2300Collector(),
            "access_point": MockApCollector()
        }

    def get_collector(self, device_type: str, model: str = None) -> BaseDeviceCollector:
        if model and "EX2300" in model.upper():
            return self._collectors.get("access_switch")
            
        collector = self._collectors.get(device_type)
        if not collector:
            raise ValueError(f"No collector registered for device type: {device_type}")
        return collector

collector_registry = CollectorRegistry()

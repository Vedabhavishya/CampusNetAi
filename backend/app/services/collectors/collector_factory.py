from .base_collector import BaseDeviceCollector
from .srx_collector import SRXCollector
from .mock.mock_switch import MockCoreSwitchCollector, MockAccessSwitchCollector
from .mock.mock_ap import MockApCollector

class CollectorRegistry:
    """
    Vendor-agnostic factory mapping device types to physical or mock collectors.
    """
    def __init__(self):
        self._collectors = {
            "firewall": SRXCollector(),
            "core_switch": MockCoreSwitchCollector(),
            "access_switch": MockAccessSwitchCollector(),
            "access_point": MockApCollector()
        }

    def get_collector(self, device_type: str) -> BaseDeviceCollector:
        collector = self._collectors.get(device_type)
        if not collector:
            raise ValueError(f"No collector registered for device type: {device_type}")
        return collector

collector_registry = CollectorRegistry()

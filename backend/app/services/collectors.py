# Compatibility wrapper for the modular collectors package
# Ensures that any legacy imports pointing to services.collectors continue to function seamlessly.

from .collectors.collector_factory import collector_registry, CollectorRegistry
from .collectors.base_collector import BaseDeviceCollector, BaseCollector
from .collectors.srx_collector import SRXCollector as FirewallCollector
from .collectors.mock.mock_switch import MockCoreSwitchCollector as CoreSwitchCollector
from .collectors.mock.mock_switch import MockAccessSwitchCollector as AccessSwitchCollector
from .collectors.mock.mock_ap import MockApCollector as ApCollector

from abc import ABC, abstractmethod

class BaseDeviceCollector(ABC):
    """
    Legacy compatibility base class defining the required legacy interfaces.
    """
    @abstractmethod
    def collect_status(self, ip_address: str, mac_address: str, config: dict = None) -> dict:
        pass
    
    @abstractmethod
    def push_configuration(self, ip_address: str, config: dict, credentials: dict = None) -> bool:
        pass


class BaseCollector(BaseDeviceCollector, ABC):
    """
    Framework abstract base class defining standard vendor-agnostic collector capabilities.
    """
    @abstractmethod
    def connect(self) -> bool:
        pass

    @abstractmethod
    def disconnect(self):
        pass

    @abstractmethod
    def collect(self) -> dict:
        """
        Runs the full collection cycle on the device and returns structured telemetry.
        """
        pass

    @abstractmethod
    def health(self) -> dict:
        """
        Returns collector connection health, poll rates, latency, etc.
        """
        pass

    @abstractmethod
    def get_inventory(self) -> dict:
        """
        Returns device inventory details (serial, model, vendor, version, etc.).
        """
        pass

    @abstractmethod
    def get_interfaces(self) -> list:
        """
        Returns physical interface links status and IP allocation tables.
        """
        pass

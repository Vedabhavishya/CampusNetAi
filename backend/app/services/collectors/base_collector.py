import os
from abc import ABC, abstractmethod

CPU_WARNING = float(os.getenv("HEALTH_CPU_WARNING", "80"))
CPU_CRITICAL = float(os.getenv("HEALTH_CPU_CRITICAL", "90"))

MEM_WARNING = float(os.getenv("HEALTH_MEM_WARNING", "80"))
MEM_CRITICAL = float(os.getenv("HEALTH_MEM_CRITICAL", "90"))

TEMP_WARNING = float(os.getenv("HEALTH_TEMP_WARNING", "55"))
TEMP_CRITICAL = float(os.getenv("HEALTH_TEMP_CRITICAL", "70"))

def calculate_health_score(
    connected: bool,
    cpu_usage: float,
    memory_usage: float,
    temperature: float,
    down_interfaces_count: int,
    error_interfaces_count: int,
    command_failures_count: int,
    cpu_warning: float = CPU_WARNING,
    cpu_critical: float = CPU_CRITICAL,
    mem_warning: float = MEM_WARNING,
    mem_critical: float = MEM_CRITICAL,
    temp_warning: float = TEMP_WARNING,
    temp_critical: float = TEMP_CRITICAL
) -> int:
    if not connected:
        return 0
    score = 100
    if cpu_usage > cpu_critical:
        score -= 20
    elif cpu_usage > cpu_warning:
        score -= 10
        
    if memory_usage > mem_critical:
        score -= 20
    elif memory_usage > mem_warning:
        score -= 10
        
    if temperature > temp_critical:
        score -= 25
    elif temperature > temp_warning:
        score -= 10
        
    score -= down_interfaces_count * 1
    score -= error_interfaces_count * 2
    score -= command_failures_count * 5
    
    return max(0, min(100, score))


class BaseDeviceCollector(ABC):
    """
    Legacy compatibility base class defining the required legacy interfaces.
    """
    @abstractmethod
    def collect_status(self, ip_address: str, mac_address: str, config: dict = None, device_id: str = None) -> dict:
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

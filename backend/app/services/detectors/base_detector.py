from abc import ABC, abstractmethod

class BaseDetector(ABC):
    """
    Abstract Base Class for all network anomaly/threat detectors.
    """
    @abstractmethod
    def detect(self, *args, **kwargs) -> list:
        pass

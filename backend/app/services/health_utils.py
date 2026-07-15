# Forwarding wrapper for health_engine structure.
from .health.health_engine import (
    CPU_WARNING,
    CPU_CRITICAL,
    MEM_WARNING,
    MEM_CRITICAL,
    TEMP_WARNING,
    TEMP_CRITICAL,
    AP_CLIENT_OVERLOAD_LIMIT,
    AP_RETRY_CRITICAL_RATE,
    calculate_ap_health_score,
    calculate_switch_health_score,
    calculate_firewall_health_score,
    calculate_device_health,
    DEVICE_HEALTH_CALCULATORS
)

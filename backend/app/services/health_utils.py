import os
import logging

logger = logging.getLogger("HealthEngine")

# Named constants for Access Point health evaluation
CPU_WARNING = float(os.getenv("HEALTH_CPU_WARNING", "80"))
CPU_CRITICAL = float(os.getenv("HEALTH_CPU_CRITICAL", "90"))

MEM_WARNING = float(os.getenv("HEALTH_MEM_WARNING", "80"))
MEM_CRITICAL = float(os.getenv("HEALTH_MEM_CRITICAL", "90"))

TEMP_WARNING = float(os.getenv("HEALTH_TEMP_WARNING", "55"))
TEMP_CRITICAL = float(os.getenv("HEALTH_TEMP_CRITICAL", "70"))

AP_CLIENT_OVERLOAD_LIMIT = int(os.getenv("AP_CLIENT_OVERLOAD_LIMIT", "30"))
AP_RETRY_CRITICAL_RATE = float(os.getenv("AP_RETRY_CRITICAL_RATE", "10.0"))

def calculate_ap_health_score(telemetry: dict, thresholds: dict = None) -> int:
    """
    Evaluates health score for Access Points based on hardware stats,
    client density, and wireless signal retry rates.
    """
    if not telemetry:
        return 0
        
    status = telemetry.get("status", "offline")
    if status == "offline":
        return 0

    score = 100
    
    # Extract thresholds with overrides
    t = thresholds or {}
    cpu_w = t.get("cpu_warning", CPU_WARNING)
    cpu_c = t.get("cpu_critical", CPU_CRITICAL)
    mem_w = t.get("mem_warning", MEM_WARNING)
    mem_c = t.get("mem_critical", MEM_CRITICAL)
    temp_w = t.get("temp_warning", TEMP_WARNING)
    temp_c = t.get("temp_critical", TEMP_CRITICAL)
    client_limit = t.get("client_limit", AP_CLIENT_OVERLOAD_LIMIT)
    retry_limit = t.get("retry_limit", AP_RETRY_CRITICAL_RATE)

    # 1. API Disconnected check
    site_conn = telemetry.get("wireless", {}).get("site", {}).get("connection", {})
    if site_conn and not site_conn.get("connected", True):
        score -= 20

    # 2. CPU penalty
    cpu = telemetry.get("cpu_usage", 0)
    if cpu > cpu_c:
        score -= 20
    elif cpu > cpu_w:
        score -= 10

    # 3. Memory penalty
    mem = telemetry.get("memory_usage", 0)
    if mem > mem_c:
        score -= 20
    elif mem > mem_w:
        score -= 10

    # 4. Temperature penalty
    temp = telemetry.get("temperature", 0.0)
    if temp > temp_c:
        score -= 25
    elif temp > temp_w:
        score -= 10

    # 5. Client Overload penalty
    clients_count = telemetry.get("connected_clients_count", 0)
    if clients_count > client_limit:
        score -= 10

    # 6. Retry Rate penalty
    retry_rate = telemetry.get("wireless", {}).get("ap", {}).get("retry_rate", 0.0)
    if retry_rate > retry_limit:
        score -= 15

    # 7. LLDP Neighbor missing penalty
    switch_name = telemetry.get("switch_name", "")
    if not switch_name or switch_name.lower() in ["unknown", "n/a", ""]:
        score -= 5

    # 8. PoE Fault penalty
    poe_status = telemetry.get("poe_status", "ok").lower()
    if poe_status == "fault" or poe_status == "error":
        score -= 10

    return max(0, min(100, score))


def calculate_switch_health_score(telemetry: dict, thresholds: dict = None) -> int:
    """
    Evaluates health score for Core and Access switches.
    """
    if not telemetry:
        return 0
    if telemetry.get("status") == "offline":
        return 0
        
    score = 100
    t = thresholds or {}
    cpu_w = t.get("cpu_warning", CPU_WARNING)
    cpu_c = t.get("cpu_critical", CPU_CRITICAL)
    mem_w = t.get("mem_warning", MEM_WARNING)
    mem_c = t.get("mem_critical", MEM_CRITICAL)
    temp_w = t.get("temp_warning", TEMP_WARNING)
    temp_c = t.get("temp_critical", TEMP_CRITICAL)

    cpu = telemetry.get("cpu_usage", 0)
    if cpu > cpu_c:
        score -= 20
    elif cpu > cpu_w:
        score -= 10

    mem = telemetry.get("memory_usage", 0)
    if mem > mem_c:
        score -= 20
    elif mem > mem_w:
        score -= 10

    temp = telemetry.get("temperature", 0.0)
    if temp > temp_c:
        score -= 25
    elif temp > temp_w:
        score -= 10

    # Switch port down / errors deductions
    interfaces = telemetry.get("interfaces", {})
    if isinstance(interfaces, dict):
        down_count = sum(1 for i in interfaces.values() if i.get("admin") == "down" or i.get("link") == "down")
        score -= min(10, down_count * 1) # Cap port down penalty at 10

    return max(0, min(100, score))


def calculate_firewall_health_score(telemetry: dict, thresholds: dict = None) -> int:
    """
    Evaluates health score for Firewalls.
    """
    if not telemetry:
        return 0
    if telemetry.get("status") == "offline":
        return 0
        
    score = 100
    t = thresholds or {}
    cpu_w = t.get("cpu_warning", CPU_WARNING)
    cpu_c = t.get("cpu_critical", CPU_CRITICAL)
    mem_w = t.get("mem_warning", MEM_WARNING)
    mem_c = t.get("mem_critical", MEM_CRITICAL)

    cpu = telemetry.get("cpu_usage", 0)
    if cpu > cpu_c:
        score -= 20
    elif cpu > cpu_w:
        score -= 10

    mem = telemetry.get("memory_usage", 0)
    if mem > mem_c:
        score -= 20
    elif mem > mem_w:
        score -= 10

    return max(0, min(100, score))


DEVICE_HEALTH_CALCULATORS = {
    "access_point": calculate_ap_health_score,
    "switch": calculate_switch_health_score,
    "core_switch": calculate_switch_health_score,
    "access_switch": calculate_switch_health_score,
    "firewall": calculate_firewall_health_score
}

def calculate_device_health(device_type: str, telemetry: dict, thresholds: dict = None) -> int:
    """
    Dispatcher delegates device-specific scoring dynamically using calculations registry map.
    """
    calculator = DEVICE_HEALTH_CALCULATORS.get(device_type)
    if calculator:
        try:
            score = calculator(telemetry, thresholds)
            logger.info(f"Health score computed for {device_type}: {score}%")
            return score
        except Exception as e:
            logger.error(f"Error calculating health for device type '{device_type}': {e}")
            return 50
    else:
        # Default fallback
        logger.warning(f"No health calculator registered for device type: {device_type}")
        return 90

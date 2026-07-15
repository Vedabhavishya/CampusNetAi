import os
import logging

logger = logging.getLogger("HealthEngine")

# Named constants for health evaluation
CPU_WARNING = float(os.getenv("HEALTH_CPU_WARNING", "80"))
CPU_CRITICAL = float(os.getenv("HEALTH_CPU_CRITICAL", "90"))

MEM_WARNING = float(os.getenv("HEALTH_MEM_WARNING", "80"))
MEM_CRITICAL = float(os.getenv("HEALTH_MEM_CRITICAL", "90"))

TEMP_WARNING = float(os.getenv("HEALTH_TEMP_WARNING", "55"))
TEMP_CRITICAL = float(os.getenv("HEALTH_TEMP_CRITICAL", "70"))

AP_CLIENT_OVERLOAD_LIMIT = int(os.getenv("AP_CLIENT_OVERLOAD_LIMIT", "30"))
AP_RETRY_CRITICAL_RATE = float(os.getenv("AP_RETRY_CRITICAL_RATE", "10.0"))

def calculate_ap_health_score(telemetry: dict, thresholds: dict = None) -> int:
    if not telemetry:
        return 0
        
    status = telemetry.get("status", "offline")
    if status == "offline":
        return 0

    score = 100
    t = thresholds or {}
    cpu_w = t.get("cpu_warning", CPU_WARNING)
    cpu_c = t.get("cpu_critical", CPU_CRITICAL)
    mem_w = t.get("mem_warning", MEM_WARNING)
    mem_c = t.get("mem_critical", MEM_CRITICAL)
    temp_w = t.get("temp_warning", TEMP_WARNING)
    temp_c = t.get("temp_critical", TEMP_CRITICAL)
    client_limit = t.get("client_limit", AP_CLIENT_OVERLOAD_LIMIT)
    retry_limit = t.get("retry_limit", AP_RETRY_CRITICAL_RATE)

    site_conn = telemetry.get("wireless", {}).get("site", {}).get("connection", {})
    if site_conn and not site_conn.get("connected", True):
        score -= 20

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

    clients_count = telemetry.get("connected_clients_count", 0)
    if clients_count > client_limit:
        score -= 10

    retry_rate = telemetry.get("wireless", {}).get("ap", {}).get("retry_rate", 0.0)
    if retry_rate > retry_limit:
        score -= 15

    switch_name = telemetry.get("switch_name", "")
    if not switch_name or switch_name.lower() in ["unknown", "n/a", ""]:
        score -= 5

    poe_status = telemetry.get("poe_status", "ok").lower()
    if poe_status == "fault" or poe_status == "error":
        score -= 10

    return max(0, min(100, score))


def calculate_switch_health_score(telemetry: dict, thresholds: dict = None) -> int:
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

    interfaces = telemetry.get("interfaces", {})
    if isinstance(interfaces, dict):
        down_count = sum(1 for i in interfaces.values() if i.get("admin") == "down" or i.get("link") == "down")
        score -= min(10, down_count * 1)
    elif isinstance(interfaces, list):
        down_count = sum(1 for i in interfaces if i.get("admin") == "down" or i.get("link") == "down")
        score -= min(10, down_count * 1)

    return max(0, min(100, score))


def calculate_firewall_health_score(telemetry: dict, thresholds: dict = None) -> int:
    """
    Evaluates health score for Firewalls incorporating active session counts,
    interface drops/errors, SSH latencies, and routing metrics.
    """
    if not telemetry:
        return 0
    if telemetry.get("status") == "offline" or telemetry.get("connected") is False:
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

    # Session Table Full (> 5000 sessions)
    active_sessions = telemetry.get("active_sessions", 0)
    if active_sessions > 5000:
        score -= 20
    elif active_sessions > 2000:
        score -= 10

    # Routing Table Missing
    routes = telemetry.get("routes", [])
    if not routes:
        score -= 25

    # Interface Errors/Drops
    interfaces = telemetry.get("interfaces", [])
    if isinstance(interfaces, list):
        for iface in interfaces:
            if iface.get("errors", 0) > 0 or iface.get("drops", 0) > 0:
                score -= 5

    # SSH latency penalty (> 500ms)
    perf = telemetry.get("performance", {}).get("current", {})
    ssh_lat = perf.get("ssh_latency_ms", 0)
    if ssh_lat > 500:
        score -= 10
    elif ssh_lat > 200:
        score -= 5

    # Missed polls / command failures
    cmd_failed = perf.get("commands_failed", 0)
    if cmd_failed > 0:
        score -= (cmd_failed * 5)

    return max(0, min(100, score))


DEVICE_HEALTH_CALCULATORS = {
    "access_point": calculate_ap_health_score,
    "switch": calculate_switch_health_score,
    "core_switch": calculate_switch_health_score,
    "access_switch": calculate_switch_health_score,
    "firewall": calculate_firewall_health_score
}

def calculate_device_health(device_type: str, telemetry: dict, thresholds: dict = None) -> int:
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
        logger.warning(f"No health calculator registered for device type: {device_type}")
        return 90

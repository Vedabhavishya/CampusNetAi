import logging

logger = logging.getLogger("TelemetryMerger")

def merge_telemetry(existing: dict, incoming: dict) -> dict:
    """
    Safely merges incoming telemetry data into the existing telemetry structure.
    Preserves key nested structures like wired ports, routes, firewall policies,
    and only updates keys provided by the incoming collector status payload.
    """
    if not existing:
        return incoming or {}
    if not incoming:
        return existing

    # Create a copy of the existing cache entry
    merged = dict(existing)

    # 1. Merge top-level metrics
    for k in ["status", "cpu_usage", "memory_usage", "uptime", "model", "version", "temperature", "health_score"]:
        if k in incoming:
            merged[k] = incoming[k]

    # 2. Merge nested telemetry dictionaries
    existing_tel = merged.get("telemetry", {})
    if not isinstance(existing_tel, dict):
        existing_tel = {}
    else:
        existing_tel = dict(existing_tel)

    incoming_tel = incoming.get("telemetry", {})
    if isinstance(incoming_tel, dict):
        # Update existing keys but do NOT drop unrelated keys (like lldp_neighbors, routes, policies, zones)
        for k, v in incoming_tel.items():
            if k in ["interfaces", "port_statistics", "mac_table", "lldp_neighbors", "routes", "zones", "policies"]:
                if v or k not in existing_tel:
                    existing_tel[k] = v
            else:
                existing_tel[k] = v

    merged["telemetry"] = existing_tel

    # 3. Merge collector state metadata
    existing_coll = merged.get("collector", {})
    if not isinstance(existing_coll, dict):
        existing_coll = {}
    else:
        existing_coll = dict(existing_coll)
        
    incoming_coll = incoming.get("collector", {})
    if isinstance(incoming_coll, dict):
        existing_coll.update(incoming_coll)
        
    merged["collector"] = existing_coll

    logger.debug(f"[Merger] Telemetry merge completed: keys={list(merged.keys())}")
    return merged

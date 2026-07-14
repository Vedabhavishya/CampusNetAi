import logging

logger = logging.getLogger("TelemetryValidator")

def validate_telemetry(device_type: str, telemetry: dict) -> bool:
    """
    Validates telemetry structure and values for range and format correctness.
    Returns True if fully valid, False if any warnings were flagged (still safe to merge).
    """
    if not telemetry:
        logger.warning(f"[Validator] Telemetry is empty or null for {device_type}")
        return False

    is_valid = True

    # 1. Base device validation
    if device_type == "access_point":
        # Check MAC exists
        mac = telemetry.get("mac")
        if not mac or mac == "N/A":
            logger.warning("[Validator] AP MAC address is missing or N/A")
            is_valid = False
            
        # Check IP exists
        ip = telemetry.get("ip")
        if not ip or ip == "N/A":
            logger.warning("[Validator] AP IP address is missing or N/A")
            is_valid = False

        # 2. Check channel bounds in radios
        radios = telemetry.get("radios", {})
        if isinstance(radios, dict):
            for band, stat in radios.items():
                chan = stat.get("channel", 0)
                if not (1 <= chan <= 200):
                    logger.warning(f"[Validator] AP radio band {band} has invalid channel: {chan}")
                    is_valid = False
                
                util = stat.get("utilization", 0)
                if not (0 <= util <= 100):
                    logger.warning(f"[Validator] AP radio band {band} has invalid utilization: {util}%")
                    is_valid = False

        # 3. Check LLDP switch mapping
        switch_name = telemetry.get("switch_name")
        switch_port = telemetry.get("switch_port")
        if (switch_name and not switch_port) or (switch_port and not switch_name):
            logger.warning(f"[Validator] AP switch uplink is partially defined: name={switch_name}, port={switch_port}")
            is_valid = False

        # 4. Check client MAC uniqueness and values
        wireless_section = telemetry.get("wireless", {})
        site_section = wireless_section.get("site", {})
        clients = site_section.get("clients", [])
        wlans = site_section.get("wlans", [])

        # Validate site-wide WLAN VLAN numbers
        for w in wlans:
            vlan = w.get("vlan_id", 0)
            if not (1 <= vlan <= 4094):
                logger.warning(f"[Validator] WLAN {w.get('ssid')} has invalid VLAN ID: {vlan}")
                is_valid = False

        # Validate client properties
        client_macs = set()
        for c in clients:
            c_mac = c.get("mac")
            if not c_mac:
                logger.warning("[Validator] Site client missing MAC address")
                is_valid = False
                continue

            if c_mac in client_macs:
                logger.warning(f"[Validator] Duplicate MAC detected in site clients list: {c_mac}")
                is_valid = False
            client_macs.add(c_mac)

            # RSSI check
            rssi = c.get("rssi", 0)
            if not (-100 <= rssi <= 0):
                logger.warning(f"[Validator] Client {c_mac} has out-of-bounds RSSI: {rssi} dBm")
                is_valid = False

            # SNR check
            snr = c.get("snr", 0)
            if not (0 <= snr <= 100):
                logger.warning(f"[Validator] Client {c_mac} has out-of-bounds SNR: {snr} dB")
                is_valid = False

            # Check client maps to exactly one AP mac
            ap_mac = c.get("ap_mac")
            if not ap_mac:
                logger.warning(f"[Validator] Client {c_mac} is not mapped to any AP MAC")
                is_valid = False

    return is_valid

import logging

logger = logging.getLogger("NetworkCorrelator")

class NetworkCorrelator:
    """
    NetworkCorrelator relates telemetry metrics across multiple vendor systems.
    
    Future Roadmap:
    - correlate_lldp(): Resolve multi-tier switch LLDP topology maps.
    - correlate_clients(): Correlate DHCP MAC leases with physical ports and AP radios.
    - correlate_vlans(): Verify VLAN tagging consistency between switch ports and wireless SSIDs.
    - correlate_topology(): Build end-to-end topological graph of the network infrastructure.
    """

    @staticmethod
    def correlate_wireless(ap_telemetry: dict, switch_telemetry: dict) -> dict:
        """
        Correlates Access Point wireless telemetry with EX2300 switch telemetry.
        Determines authoritative switch uplink ports via LLDP neighbors, resolves PoE stats,
        and links device metadata. Returns a new correlated telemetry dictionary.
        """
        if not ap_telemetry:
            return {}

        # Shallow copy to avoid side effects
        correlated = dict(ap_telemetry)
        
        ap_mac = correlated.get("mac", "").replace(":", "").lower()
        ap_name = correlated.get("name", "").lower()
        
        found_lldp = False
        lldp_port = None
        lldp_switch_name = None
        
        if switch_telemetry and "telemetry" in switch_telemetry:
            switch_t = switch_telemetry["telemetry"]
            lldp_neighbors = switch_t.get("lldp_neighbors", [])
            switch_hostname = switch_t.get("hostname", "ex2300 switch")
            
            # 1. Search for matching AP in switch's LLDP neighbors
            for neighbor in lldp_neighbors:
                n_chassis = neighbor.get("neighbor_chassis_id", "").replace(":", "").lower()
                n_host = neighbor.get("neighbor_hostname", "").lower()
                
                # Match by MAC address or hostname
                if (n_chassis and ap_mac in n_chassis) or (n_host and (ap_name in n_host or n_host in ap_name)):
                    lldp_port = neighbor.get("local_interface")
                    lldp_switch_name = switch_hostname
                    found_lldp = True
                    break
        
        # 2. Apply authoritative LLDP mappings
        if found_lldp and lldp_port:
            correlated["switch_name"] = lldp_switch_name
            correlated["switch_port"] = lldp_port
            correlated["lldp_status"] = "OK"
            correlated["lldp_neighbor_missing"] = False
        else:
            # Mist inventory values remain if LLDP missing, but flag it
            correlated["lldp_status"] = "Missing"
            correlated["lldp_neighbor_missing"] = True
            
        # 3. Resolve PoE power and port status from switch telemetry
        if found_lldp and lldp_port and switch_telemetry:
            switch_t = switch_telemetry["telemetry"]
            interfaces = switch_t.get("interfaces", [])
            
            port_info = {}
            if isinstance(interfaces, list):
                for iface in interfaces:
                    if isinstance(iface, dict) and iface.get("interface") == lldp_port:
                        port_info = iface
                        break
            elif isinstance(interfaces, dict):
                port_info = interfaces.get(lldp_port, {})
                
            if port_info:
                admin_state = port_info.get("admin", "up")
                link_state = port_info.get("link", "up")
                if admin_state == "down" or link_state == "down":
                    correlated["poe_status"] = "fault"
                    correlated["poe_power"] = 0.0
                    correlated["uplink_status"] = "Down"
                else:
                    correlated["poe_status"] = "ok"
                    correlated["uplink_status"] = "Up"
            else:
                correlated["poe_status"] = "ok"
                correlated["uplink_status"] = "Up"
        else:
            # Fallback if switch telemetry is unavailable or missing LLDP
            correlated["poe_status"] = "ok"
            correlated["uplink_status"] = "Up"

        logger.info(
            f"[Correlator] AP {correlated.get('name')} correlation completed. "
            f"Switch={correlated.get('switch_name')}, Port={correlated.get('switch_port')}, "
            f"LLDP={correlated.get('lldp_status')}, PoE={correlated.get('poe_status')}"
        )
        return correlated

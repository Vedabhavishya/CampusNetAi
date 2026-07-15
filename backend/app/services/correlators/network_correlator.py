import logging
import hashlib

logger = logging.getLogger("NetworkCorrelator")

class CorrelationCache:
    """
    Caches IP-to-Access Point-to-Switch correlation paths.
    """
    def __init__(self):
        self.cache = {}
        self.last_signature = None

    def get(self, ip: str) -> dict:
        return self.cache.get(ip)

    def set(self, ip: str, path: dict):
        self.cache[ip] = path

    def invalidate_all(self):
        self.cache.clear()
        logger.info("[CorrelationCache] Cache invalidated due to network state change trigger.")

correlation_cache = CorrelationCache()

class NetworkCorrelator:
    """
    NetworkCorrelator relates telemetry metrics across multiple vendor systems.
    """
    @staticmethod
    def correlate_wireless(ap_telemetry: dict, switch_telemetry: dict) -> dict:
        if not ap_telemetry:
            return {}

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
            
            for neighbor in lldp_neighbors:
                n_chassis = neighbor.get("neighbor_chassis_id", "").replace(":", "").lower()
                n_host = neighbor.get("neighbor_hostname", "").lower()
                
                if (n_chassis and ap_mac in n_chassis) or (n_host and (ap_name in n_host or n_host in ap_name)):
                    lldp_port = neighbor.get("local_interface")
                    lldp_switch_name = switch_hostname
                    found_lldp = True
                    break
        
        if found_lldp and lldp_port:
            correlated["switch_name"] = lldp_switch_name
            correlated["switch_port"] = lldp_port
            correlated["lldp_status"] = "OK"
            correlated["lldp_neighbor_missing"] = False
        else:
            correlated["lldp_status"] = "Missing"
            correlated["lldp_neighbor_missing"] = True
            
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
            correlated["poe_status"] = "ok"
            correlated["uplink_status"] = "Up"

        return correlated

    @staticmethod
    def correlate_firewall_sessions(sessions: list, cached_devices: dict) -> list:
        """
        Correlates firewall sessions with wireless client AP and Switch Port connections.
        Employs CorrelationCache signature check to trigger invalidation upon interface/state change.
        """
        if not sessions:
            return []

        # 1. Compute state signature for Cache Invalidation
        state_str = ""
        for dev_id, dev in cached_devices.items():
            status = dev.get("status", "offline")
            interfaces = dev.get("telemetry", {}).get("interfaces", [])
            interfaces_len = len(interfaces) if isinstance(interfaces, list) else 0
            state_str += f"{dev_id}:{status}:{interfaces_len};"
            
        current_sig = hashlib.md5(state_str.encode("utf-8")).hexdigest()
        if correlation_cache.last_signature != current_sig:
            correlation_cache.invalidate_all()
            correlation_cache.last_signature = current_sig

        # 2. Map all cached wireless clients
        client_map = {}
        for dev_id, dev in cached_devices.items():
            if dev_id.startswith("dev-ap-"):
                telemetry = dev.get("telemetry", {})
                wireless = telemetry.get("wireless", {})
                clients = wireless.get("clients", [])
                ap_name = telemetry.get("hostname", "Access Point")
                switch_name = telemetry.get("switch_name", "ex2300 switch")
                switch_port = telemetry.get("switch_port", "ge-0/0/1")
                
                for c in clients:
                    ip = c.get("ip")
                    if ip:
                        client_map[ip] = {
                            "name": c.get("name", "Wireless Host"),
                            "ap_name": ap_name,
                            "switch_name": switch_name,
                            "switch_port": switch_port
                        }

        # 3. Perform correlation using cache
        correlated_sessions = []
        for s in sessions:
            src_ip = s.get("source_ip")
            if not src_ip:
                continue

            cached_path = correlation_cache.get(src_ip)
            if cached_path:
                path = dict(cached_path)
            else:
                client = client_map.get(src_ip)
                if client:
                    path = {
                        "client_ip": src_ip,
                        "client_name": client["name"],
                        "ap_name": client["ap_name"],
                        "switch_name": client["switch_name"],
                        "switch_port": client["switch_port"],
                        "firewall_name": "srx300 firewall"
                    }
                else:
                    # Fallback for wired / unknown clients
                    path = {
                        "client_ip": src_ip,
                        "client_name": f"Wired Host ({src_ip})",
                        "ap_name": "N/A",
                        "switch_name": "ex2300 switch",
                        "switch_port": "ge-0/0/2",
                        "firewall_name": "srx300 firewall"
                    }
                correlation_cache.set(src_ip, path)

            # Complete specific connection session details
            path_copy = dict(path)
            path_copy["session_id"] = s.get("session_id")
            path_copy["destination_ip"] = s.get("destination_ip")
            path_copy["protocol"] = s.get("protocol")
            path_copy["bytes"] = s.get("bytes_in", 0) + s.get("bytes_out", 0)
            correlated_sessions.append(path_copy)

        return correlated_sessions

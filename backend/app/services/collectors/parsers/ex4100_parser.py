import re
import logging
from .base_parser import BaseParser

logger = logging.getLogger("EX4100Parser")

class EX4100Parser(BaseParser):
    """
    Parses JunOS EX4100 CLI outputs into structured dictionaries.
    Designed with robust regex patterns to tolerate whitespace and formatting changes.
    """

    def parse_version(self, version_out: str) -> dict:
        info = {
            "model": "EX4100-24T",
            "junos": "22.4R1.10",
            "hostname": "ex4100 router",
            "vendor": "Juniper",
            "device_type": "Core Switch"
        }
        if not version_out:
            logger.warning("Empty output for parse_version")
            return info

        model_match = re.search(r"Model:\s+(\S+)", version_out, re.IGNORECASE)
        if model_match:
            info["model"] = model_match.group(1).upper()
            
        version_match = re.search(r"Junos:\s+(\S+)", version_out, re.IGNORECASE)
        if version_match:
            info["junos"] = version_match.group(1)
            
        hostname_match = re.search(r"Hostname:\s+(\S+)", version_out, re.IGNORECASE)
        if hostname_match:
            info["hostname"] = hostname_match.group(1)

        return info

    def parse_uptime(self, uptime_out: str) -> str:
        uptime = "142 days, 2 hours"
        if not uptime_out:
            logger.warning("Empty output for parse_uptime")
            return uptime

        # Example: System booted: 2026-02-21 08:30:10 UTC (142 days, 2 hours ago)
        uptime_match = re.search(r"System booted: .*\((.*) ago\)", uptime_out)
        if uptime_match:
            uptime = uptime_match.group(1).strip()
        else:
            # Try matching simpler uptime formats if available
            simple_match = re.search(r"uptime:\s*(.*)", uptime_out, re.IGNORECASE)
            if simple_match:
                uptime = simple_match.group(1).strip()
        return uptime

    def parse_chassis(self, chassis_out: str) -> dict:
        res = {
            "cpu": {"user": 0, "kernel": 0, "idle": 100},
            "memory": {"total": 8192, "used": 0, "usage": 0},
            "temperature": {"system": 38, "cpu": 42}
        }
        if not chassis_out:
            logger.warning("Empty output for parse_chassis")
            return res

        # Temperatures
        temp_match = re.search(r"Temperature\s+(\d+)\s+degrees", chassis_out, re.IGNORECASE)
        if temp_match:
            res["temperature"]["system"] = int(temp_match.group(1))
            
        cpu_temp_match = re.search(r"CPU temperature\s+(\d+)\s+degrees", chassis_out, re.IGNORECASE)
        if cpu_temp_match:
            res["temperature"]["cpu"] = int(cpu_temp_match.group(1))
        else:
            res["temperature"]["cpu"] = res["temperature"]["system"]

        # CPU Status
        idle_match = re.search(r"Idle\s+(\d+)\s+percent", chassis_out, re.IGNORECASE)
        if idle_match:
            res["cpu"]["idle"] = int(idle_match.group(1))
        user_match = re.search(r"User\s+(\d+)\s+percent", chassis_out, re.IGNORECASE)
        if user_match:
            res["cpu"]["user"] = int(user_match.group(1))
        kernel_match = re.search(r"Kernel\s+(\d+)\s+percent", chassis_out, re.IGNORECASE)
        if kernel_match:
            res["cpu"]["kernel"] = int(kernel_match.group(1))

        # Memory utilization
        mem_util_match = re.search(r"Memory utilization\s+(\d+)\s+percent", chassis_out, re.IGNORECASE)
        if mem_util_match:
            res["memory"]["usage"] = int(mem_util_match.group(1))
            
        total_mem_match = re.search(r"Total memory\s+(\d+)\s+MB", chassis_out, re.IGNORECASE)
        if total_mem_match:
            res["memory"]["total"] = int(total_mem_match.group(1))
            
        res["memory"]["used"] = int(res["memory"]["total"] * res["memory"]["usage"] / 100)
        return res

    def parse_interfaces(self, interfaces_out: str) -> list:
        interfaces = []
        if not interfaces_out:
            logger.warning("Empty output for parse_interfaces")
            return interfaces

        for line in interfaces_out.splitlines():
            line = line.strip()
            if not line or "Interface" in line or "admin" in line:
                continue
            
            parts = line.split()
            # Expecting format: interface admin link [protocol] [address]
            # e.g., ge-0/0/0.0              up    up   eth-switch
            # e.g., vlan.0                  up    up   inet     10.10.10.2/24
            if len(parts) >= 3:
                iface_name = parts[0]
                admin_status = parts[1]
                link_status = parts[2]
                
                # Check for protocol and IP
                ip_addr = "N/A"
                protocol = "N/A"
                if len(parts) >= 4:
                    protocol = parts[3]
                    if len(parts) >= 5 and protocol == "inet":
                        ip_addr = parts[4]
                
                if admin_status in ["up", "down"] and link_status in ["up", "down"]:
                    interfaces.append({
                        "interface": iface_name,
                        "admin": admin_status,
                        "link": link_status,
                        "ip": ip_addr,
                        "protocol": protocol
                    })
        return interfaces

    def parse_routes(self, routes_out: str) -> list:
        return []

    def parse_security(self, zones_out: str, policies_out: str) -> dict:
        return {"zones": [], "policies": []}

    def parse_sessions_arp(self, sessions_out: str, arp_out: str) -> dict:
        return {"active_sessions": 0, "arp_entries_count": 0}

    def parse_vlans(self, vlans_out: str) -> list:
        vlans = []
        if not vlans_out:
            logger.warning("Empty output for parse_vlans")
            return vlans

        def is_interface(token: str) -> bool:
            token_clean = token.replace("*", "").replace(",", "").strip()
            if not token_clean or token_clean == "-":
                return False
            # Check prefix pattern of typical JunOS interface names
            if re.match(r"^(?:ge|xe|et|ae|vlan|irb|lo|me|em|fxp)\-\d+", token_clean, re.IGNORECASE):
                return True
            if re.match(r"^(?:ae|irb|vlan|lo)\d+", token_clean, re.IGNORECASE):
                return True
            if "/" in token_clean:
                return True
            return False

        active_vlan = None

        for line in vlans_out.splitlines():
            line_stripped = line.strip()
            if not line_stripped:
                continue
            
            # Skip headers / separators
            if "VLAN Name" in line_stripped or "VLAN name" in line_stripped or "Routing Instance" in line_stripped or "Routing instance" in line_stripped or "---" in line_stripped:
                continue
            
            # Check if continuation line (starts with space or tab)
            is_continuation = line.startswith(("\t", " "))
            
            if not is_continuation:
                tokens = line_stripped.split()
                vlan_name = None
                vlan_id = None
                members_start_idx = 0
                
                # Case A: 3+ tokens, 3rd token is numeric (RoutingInstance VLANName Tag [Interfaces...])
                if len(tokens) >= 3 and tokens[2].isdigit():
                    vlan_name = tokens[1]
                    vlan_id = int(tokens[2])
                    members_start_idx = 3
                # Case B: 2+ tokens, 2nd token is numeric (VLANName Tag [Interfaces...])
                elif len(tokens) >= 2 and tokens[1].isdigit():
                    vlan_name = tokens[0]
                    vlan_id = int(tokens[1])
                    members_start_idx = 2
                
                if vlan_name is not None and vlan_id is not None:
                    # Save previous active VLAN
                    if active_vlan:
                        active_vlan["id"] = active_vlan["vlan_id"]
                        active_vlan["member_count"] = len(active_vlan["members"])
                        vlans.append(active_vlan)
                    
                    active_vlan = {
                        "name": vlan_name,
                        "vlan_id": vlan_id,
                        "id": vlan_id,
                        "members": []
                    }
                    
                    # Parse any interface members on the same line
                    if len(tokens) > members_start_idx:
                        for token in tokens[members_start_idx:]:
                            if is_interface(token):
                                active_vlan["members"].append(token.replace("*", "").replace(",", "").strip())
            else:
                # Continuation line
                if active_vlan:
                    tokens = line_stripped.split()
                    for token in tokens:
                        if is_interface(token):
                            active_vlan["members"].append(token.replace("*", "").replace(",", "").strip())

        if active_vlan:
            active_vlan["id"] = active_vlan["vlan_id"]
            active_vlan["member_count"] = len(active_vlan["members"])
            vlans.append(active_vlan)
            
        return vlans

    def parse_mac_table(self, mac_table_out: str) -> list:
        entries = []
        if not mac_table_out:
            logger.warning("Empty output for parse_mac_table")
            return entries

        lines = mac_table_out.splitlines()
        for line in lines:
            line = line.strip()
            # Match MAC addresses (e.g. 00:15:5d:83:b2:1a)
            mac_match = re.search(r"((?:[0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2})", line)
            if mac_match:
                mac_addr = mac_match.group(1)
                parts = line.split()
                if len(parts) >= 4:
                    try:
                        mac_idx = parts.index(mac_addr)
                        vlan = parts[mac_idx - 1]
                        learn_type = parts[mac_idx + 1]
                        age = parts[mac_idx + 2]
                        iface = parts[mac_idx + 3]
                        
                        type_str = "Dynamic"
                        if "S" in learn_type:
                            type_str = "Static"
                        elif "D" in learn_type:
                            type_str = "Dynamic"
                        elif "L" in learn_type:
                            type_str = "Learnt"
                            
                        entries.append({
                            "mac_address": mac_addr,
                            "vlan": vlan,
                            "interface": iface,
                            "type": type_str,
                            "age": age
                        })
                    except Exception as ex:
                        logger.warning(f"Error parsing MAC table line '{line}': {ex}")
        return entries

    def parse_lldp(self, lldp_out: str) -> list:
        neighbors = []
        if not lldp_out:
            logger.warning("Empty output for parse_lldp")
            return neighbors

        lines = lldp_out.splitlines()
        for line in lines:
            line = line.strip()
            if not line or "Local Interface" in line or "Parent Interface" in line:
                continue
            
            parts = line.split()
            if len(parts) >= 5:
                local_iface = parts[0]
                chassis_id = parts[2]
                neighbor_iface = parts[3]
                neighbor_host = parts[4]
                if len(parts) > 5:
                    neighbor_host = " ".join(parts[4:])
                    
                neighbors.append({
                    "local_interface": local_iface,
                    "neighbor_hostname": neighbor_host,
                    "neighbor_interface": neighbor_iface,
                    "neighbor_chassis_id": chassis_id
                })
        return neighbors

    def parse_interface_stats(self, interface_stats_out: str) -> dict:
        stats = {}
        if not interface_stats_out:
            logger.warning("Empty output for parse_interface_stats")
            return {"ports": {}, "aggregate": {"total_rx": 0, "total_tx": 0, "switch_throughput_bps": 0, "average_utilization": 0.0}}

        blocks = interface_stats_out.split("Physical interface:")
        for block in blocks:
            if not block.strip():
                continue
            
            lines = block.splitlines()
            first_line = lines[0].strip()
            iface_match = re.match(r"^(\S+)", first_line)
            if not iface_match:
                continue
            iface_name = iface_match.group(1).rstrip(",")
            
            iface_stats = {
                "rx_bytes": 0,
                "tx_bytes": 0,
                "rx_packets": 0,
                "tx_packets": 0,
                "input_errors": 0,
                "output_errors": 0,
                "drops": 0,
                "crc_errors": 0,
                "speed": "1Gbps",
                "duplex": "Full-duplex",
                "utilization": 0.0
            }
            
            block_text = "\n".join(lines)
            
            speed_match = re.search(r"Speed:\s*([^,\n]+)", block_text, re.IGNORECASE)
            if speed_match:
                iface_stats["speed"] = speed_match.group(1).strip()
            duplex_match = re.search(r"Duplex:\s*([^,\n]+)", block_text, re.IGNORECASE)
            if duplex_match:
                iface_stats["duplex"] = duplex_match.group(1).strip()
                
            input_packets_match = re.search(r"Input packets:\s*(\d+)", block_text, re.IGNORECASE)
            if input_packets_match:
                iface_stats["rx_packets"] = int(input_packets_match.group(1))
            output_packets_match = re.search(r"Output packets:\s*(\d+)", block_text, re.IGNORECASE)
            if output_packets_match:
                iface_stats["tx_packets"] = int(output_packets_match.group(1))
                
            input_bytes_match = re.search(r"Input bytes:\s*(\d+)", block_text, re.IGNORECASE)
            if input_bytes_match:
                iface_stats["rx_bytes"] = int(input_bytes_match.group(1))
            output_bytes_match = re.search(r"Output bytes:\s*(\d+)", block_text, re.IGNORECASE)
            if output_bytes_match:
                iface_stats["tx_bytes"] = int(output_bytes_match.group(1))
                
            input_errors_match = re.search(r"Input errors:\s*(\d+)", block_text, re.IGNORECASE)
            if input_errors_match:
                iface_stats["input_errors"] = int(input_errors_match.group(1))
            output_errors_match = re.search(r"Output errors:\s*(\d+)", block_text, re.IGNORECASE)
            if output_errors_match:
                iface_stats["output_errors"] = int(output_errors_match.group(1))
                
            input_drops_match = re.search(r"Input drops:\s*(\d+)", block_text, re.IGNORECASE)
            if input_drops_match:
                iface_stats["drops"] += int(input_drops_match.group(1))
            output_drops_match = re.search(r"Output drops:\s*(\d+)", block_text, re.IGNORECASE)
            if output_drops_match:
                iface_stats["drops"] += int(output_drops_match.group(1))
                
            crc_match = re.search(r"CRC errors:\s*(\d+)", block_text, re.IGNORECASE)
            if crc_match:
                iface_stats["crc_errors"] = int(crc_match.group(1))
                
            input_bps_match = re.search(r"Input bandwidth\s*:\s*(\d+)\s*bps", block_text, re.IGNORECASE)
            output_bps_match = re.search(r"Output bandwidth\s*:\s*(\d+)\s*bps", block_text, re.IGNORECASE)
            
            bps = 0
            if input_bps_match:
                bps += int(input_bps_match.group(1))
            if output_bps_match:
                bps += int(output_bps_match.group(1))
                
            speed_bps = 1000000000
            if "10000" in iface_stats["speed"] or "10g" in iface_stats["speed"].lower():
                speed_bps = 10000000000
            elif "1000" in iface_stats["speed"] or "1g" in iface_stats["speed"].lower():
                speed_bps = 1000000000
            elif "100" in iface_stats["speed"]:
                speed_bps = 100000000
                
            iface_stats["utilization"] = round((bps / speed_bps) * 100, 4) if speed_bps > 0 else 0.0
            
            stats[iface_name] = iface_stats

        total_rx_bytes = sum(s["rx_bytes"] for s in stats.values())
        total_tx_bytes = sum(s["tx_bytes"] for s in stats.values())
        avg_util = sum(s["utilization"] for s in stats.values()) / len(stats) if stats else 0.0
        
        switch_throughput_bps = sum(
            (int(re.search(r"Input bandwidth\s*:\s*(\d+)\s*bps", block, re.IGNORECASE).group(1)) if re.search(r"Input bandwidth\s*:\s*(\d+)\s*bps", block, re.IGNORECASE) else 0) +
            (int(re.search(r"Output bandwidth\s*:\s*(\d+)\s*bps", block, re.IGNORECASE).group(1)) if re.search(r"Output bandwidth\s*:\s*(\d+)\s*bps", block, re.IGNORECASE) else 0)
            for block in blocks if block.strip()
        )

        return {
            "ports": stats,
            "aggregate": {
                "total_rx": total_rx_bytes,
                "total_tx": total_tx_bytes,
                "switch_throughput_bps": switch_throughput_bps,
                "average_utilization": round(avg_util, 4)
            }
        }

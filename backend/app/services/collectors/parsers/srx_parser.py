import re
from .base_parser import BaseParser

class SRXParser(BaseParser):
    """
    Parses JunOS SRX300 CLI outputs into structured dictionaries.
    """
    def parse_version(self, version_out: str) -> dict:
        info = {
            "model": "SRX300",
            "junos": "21.4R3-S3.4",
            "hostname": "SRX300-FW",
            "vendor": "Juniper",
            "device_type": "Firewall"
        }
        if not version_out:
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
        uptime = "6 hours"
        if not uptime_out:
            return uptime

        uptime_match = re.search(r"System booted: .*\((.*) ago\)", uptime_out)
        if uptime_match:
            uptime = uptime_match.group(1)
        return uptime

    def parse_chassis(self, chassis_out: str) -> dict:
        res = {
            "cpu": {"user": 0, "kernel": 0, "idle": 100},
            "memory": {"total": 4096, "used": 0, "usage": 0},
            "temperature": {"system": 42, "cpu": 42}
        }
        if not chassis_out:
            return res

        # Temperature
        temp_match = re.search(r"Temperature\s+(\d+)\s+degrees", chassis_out, re.IGNORECASE)
        if temp_match:
            res["temperature"]["system"] = int(temp_match.group(1))
            
        cpu_temp_match = re.search(r"CPU temperature\s+(\d+)\s+degrees", chassis_out, re.IGNORECASE)
        if cpu_temp_match:
            res["temperature"]["cpu"] = int(cpu_temp_match.group(1))
        else:
            res["temperature"]["cpu"] = res["temperature"]["system"]

        # CPU utilization (Idle, User, Kernel)
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
            return interfaces

        for line in interfaces_out.splitlines():
            # ge-0/0/0.0              up    up   inet     203.0.113.2/24
            parts = line.split()
            if len(parts) >= 3 and ("up" in parts[1] or "down" in parts[1]):
                iface_name = parts[0]
                admin_status = parts[1]
                link_status = parts[2]
                ip_addr = "N/A"
                if len(parts) >= 5 and parts[3] == "inet":
                    ip_addr = parts[4]
                
                interfaces.append({
                    "interface": iface_name,
                    "admin": admin_status,
                    "link": link_status,
                    "ip": ip_addr
                })
        return interfaces

    def parse_routes(self, routes_out: str) -> list:
        routes = []
        if not routes_out:
            return routes

        current_dest = ""
        for line in routes_out.splitlines():
            # 0.0.0.0/0          *[Static/5] 05:50:00, vrf public
            #                    > to 203.0.113.1 via ge-0/0/0.0
            dest_match = re.match(r"^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/\d+)", line.strip())
            if dest_match:
                current_dest = dest_match.group(1)
            elif "via" in line and current_dest:
                via_match = re.search(r"(?:to\s+(\S+)\s+)?via\s+(\S+)", line)
                if via_match:
                    gateway = via_match.group(1) or "Direct"
                    iface = via_match.group(2)
                    routes.append({
                        "destination": current_dest,
                        "gateway": gateway,
                        "interface": iface
                    })
        return routes

    def parse_security(self, zones_out: str, policies_out: str) -> dict:
        security = {
            "zones": [],
            "policies": []
        }
        
        # Parse Zones
        if zones_out:
            current_zone = ""
            zone_ifaces = []
            for line in zones_out.splitlines():
                zone_match = re.search(r"Security zone:\s+(\S+)", line, re.IGNORECASE)
                if zone_match:
                    if current_zone:
                        security["zones"].append({"zone": current_zone, "interfaces": zone_ifaces})
                    current_zone = zone_match.group(1)
                    zone_ifaces = []
                elif current_zone and re.match(r"^\s+([a-zA-Z0-9\-\/\.]+)", line):
                    iface = line.strip()
                    if iface != "Interfaces:" and iface != "":
                        iface = iface.split()[0]
                        zone_ifaces.append(iface)
            if current_zone:
                security["zones"].append({"zone": current_zone, "interfaces": zone_ifaces})

        # Parse Policies
        if policies_out:
            current_from = ""
            current_to = ""
            for line in policies_out.splitlines():
                dir_match = re.search(r"From zone:\s+(\S+),\s+To zone:\s+(\S+)", line, re.IGNORECASE)
                if dir_match:
                    current_from = dir_match.group(1).rstrip(',')
                    current_to = dir_match.group(2).rstrip(',')
                elif current_from and "Policy:" in line:
                    policy_match = re.search(r"Policy:\s+(\S+),\s+State:\s+(\S+)", line, re.IGNORECASE)
                    if policy_match:
                        security["policies"].append({
                            "fromZone": current_from,
                            "toZone": current_to,
                            "policyName": policy_match.group(1).rstrip(','),
                            "state": policy_match.group(2).rstrip(',')
                        })

        return security

    def parse_sessions_arp(self, sessions_out: str, arp_out: str) -> dict:
        res = {
            "active_sessions": 0,
            "arp_entries_count": 0
        }
        
        # Parse active sessions from: "Total sessions: 1482"
        if sessions_out:
            sessions_match = re.search(r"Total sessions:\s+(\d+)", sessions_out, re.IGNORECASE)
            if sessions_match:
                res["active_sessions"] = int(sessions_match.group(1))

        # Parse ARP entries count by counting lines that look like: "00:0b:82:11:a3:f1 192.168.1.1 ge-0/0/0.0"
        if arp_out:
            arp_count = 0
            for line in arp_out.splitlines():
                # Typical line: 00:0b:82:11:a3:f1 192.168.1.1 ge-0/0/0.0 [none]
                # Filter out header lines
                parts = line.split()
                if len(parts) >= 3 and re.match(r"^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$", parts[0]):
                    arp_count += 1
            res["arp_entries_count"] = arp_count
            
        return res

    def parse_vlans(self, vlans_out: str) -> list:
        return []

    def parse_mac_table(self, mac_table_out: str) -> list:
        return []

    def parse_lldp(self, lldp_out: str) -> list:
        return []

    def parse_interface_stats(self, interface_stats_out: str) -> dict:
        return {}

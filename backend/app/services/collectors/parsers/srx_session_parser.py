import re

class SRXSessionParser:
    """
    Parses JunOS SRX300 flow sessions command output into structured data.
    """
    def parse_basic(self, sessions_output: str) -> list:
        sessions = []
        if not sessions_output:
            return sessions
            
        chunks = sessions_output.split("Session ID: ")
        for chunk in chunks[1:]:
            lines = [line.strip() for line in chunk.splitlines() if line.strip()]
            if not lines:
                continue
                
            header = lines[0]
            id_match = re.match(r"^(\d+)", header)
            if not id_match:
                continue
            session_id = int(id_match.group(1))
            
            policy_name = "default"
            pol_match = re.search(r"Policy name:\s+([^,\s]+)", header)
            if pol_match:
                policy_name = pol_match.group(1)
                
            state = "Active"
            state_match = re.search(r"(?:Session State|State):\s*([^,\s]+)", header)
            if state_match:
                state = state_match.group(1)
                
            timeout = 0
            timeout_match = re.search(r"Timeout:\s*(\d+)", header)
            if timeout_match:
                timeout = int(timeout_match.group(1))
                
            src_ip, src_port = "0.0.0.0", 0
            dst_ip, dst_port = "0.0.0.0", 0
            protocol = "tcp"
            ingress_iface, egress_iface = "N/A", "N/A"
            pkts_in, bytes_in = 0, 0
            pkts_out, bytes_out = 0, 0
            
            for line in lines[1:]:
                if line.startswith("In:"):
                    m = re.match(r"In:\s+(\S+)/(\d+)\s+-->\s+(\S+)/(\d+);\s*([^,\s;]+)", line)
                    if m:
                        src_ip = m.group(1)
                        src_port = int(m.group(2))
                        dst_ip = m.group(3)
                        dst_port = int(m.group(4))
                        protocol = m.group(5)
                    
                    ing_match = re.search(r"(?:Ingress|If):\s*([^,\s]+)", line)
                    if ing_match:
                        ingress_iface = ing_match.group(1)
                        
                    pkt_match = re.search(r"(?:Packets|Pkts):\s*(\d+)", line)
                    if pkt_match:
                        pkts_in = int(pkt_match.group(1))
                    byt_match = re.search(r"Bytes:\s*(\d+)", line)
                    if byt_match:
                        bytes_in = int(byt_match.group(1))
                        
                elif line.startswith("Out:"):
                    egr_match = re.search(r"(?:Egress|If):\s*([^,\s]+)", line)
                    if egr_match:
                        egress_iface = egr_match.group(1)
                        
                    pkt_match = re.search(r"(?:Packets|Pkts):\s*(\d+)", line)
                    if pkt_match:
                        pkts_out = int(pkt_match.group(1))
                    byt_match = re.search(r"Bytes:\s*(\d+)", line)
                    if byt_match:
                        bytes_out = int(byt_match.group(1))
                        
            sessions.append({
                "session_id": session_id,
                "policy_name": policy_name,
                "state": state,
                "source_ip": src_ip,
                "source_port": src_port,
                "destination_ip": dst_ip,
                "destination_port": dst_port,
                "protocol": protocol,
                "ingress_interface": ingress_iface,
                "egress_interface": egress_iface,
                "packets_in": pkts_in,
                "packets_out": pkts_out,
                "bytes_in": bytes_in,
                "bytes_out": bytes_out,
                "timeout": timeout
            })
        return sessions

    def parse_extensive(self, sessions_output: str) -> list:
        return self.parse_basic(sessions_output)

    def parse_summary(self, sessions_output: str) -> dict:
        total = 0
        if sessions_output:
            sessions_match = re.search(r"Total sessions:\s+(\d+)", sessions_output, re.IGNORECASE)
            if sessions_match:
                total = int(sessions_match.group(1))
        return {"total_sessions": total}

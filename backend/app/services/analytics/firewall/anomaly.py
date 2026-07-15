from ...detectors.base_detector import BaseDetector

class FirewallAnomalyDetector(BaseDetector):
    """
    FirewallAnomalyDetector performs heuristic threat detection scans on active flows.
    """
    def detect(self, sessions: list) -> list:
        anomalies = []
        
        # 1. Port Scan Detection (more than 15 distinct ports from same client)
        src_ports = {}
        for s in sessions:
            src = s.get("source_ip")
            dst_port = s.get("destination_port")
            if src and dst_port:
                if src not in src_ports:
                    src_ports[src] = set()
                src_ports[src].add(dst_port)
                
        for src, ports in src_ports.items():
            if len(ports) > 15:
                anomalies.append({
                    "category": "security",
                    "severity": "high",
                    "title": "Port Sweep Detected",
                    "description": f"Internal host {src} queried {len(ports)} distinct destination ports.",
                    "mitigation": "Isolate the client MAC address in Security Center to block forwarding rules."
                })
                
        # 2. Large File Transfer Detection (exceeding 5MB in a session)
        for s in sessions:
            total_bytes = s.get("bytes_in", 0) + s.get("bytes_out", 0)
            if total_bytes > 5 * 1024 * 1024:
                anomalies.append({
                    "category": "bandwidth",
                    "severity": "medium",
                    "title": "Abnormal Session Bandwidth",
                    "description": f"Session {s.get('session_id')} from {s.get('source_ip')} to {s.get('destination_ip')} consumed {total_bytes / (1024*1024):.1f} MB.",
                    "mitigation": "Check client application downloads or apply bandwidth rate-limits."
                })
                
        return anomalies

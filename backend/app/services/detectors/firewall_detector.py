class ApplicationDetector:
    """
    Classifies destination ports into applications for session tracking.
    """
    def __init__(self):
        self.port_map = {
            53: "DNS",
            80: "HTTP",
            443: "HTTPS",
            22: "SSH",
            123: "NTP",
            25: "SMTP",
            3389: "RDP",
            445: "SMB",
            853: "DNS over TLS",
            5060: "SIP",
            161: "SNMP",
            1812: "RADIUS"
        }

    def detect(self, dest_port: int, protocol: str = "tcp") -> str:
        """
        Classifies traffic based on destination port.
        """
        if not dest_port:
            return "Other"
            
        p = int(dest_port)
        if p in self.port_map:
            return self.port_map[p]
            
        return f"Port {p}"

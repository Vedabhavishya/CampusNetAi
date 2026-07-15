from dataclasses import dataclass, asdict

@dataclass
class NormalizedSession:
    session_id: int
    source_ip: str
    destination_ip: str
    source_port: int
    destination_port: int
    protocol: str
    application: str
    bytes_in: int
    bytes_out: int
    packets_in: int
    packets_out: int
    policy: str
    state: str
    timeout: int
    ingress_interface: str = "N/A"
    egress_interface: str = "N/A"

    def to_dict(self) -> dict:
        return asdict(self)

from sqlalchemy.orm import Session
from ..models.models import DbUser, DbDevice, DbClient, DbVlan, DbDhcpLease, DbAlert, DbInsight
from .security import get_password_hash

def seed_database(db: Session):
    # 1. Seed Users if not present
    if db.query(DbUser).count() == 0:
        users = [
            DbUser(id="usr-1", username="admin", email="admin@campusnet.ai", hashed_password=get_password_hash("admin123"), role="Super Admin", is_active=True),
            DbUser(id="usr-2", username="netadmin", email="netadmin@campusnet.ai", hashed_password=get_password_hash("admin123"), role="Network Administrator", is_active=True),
            DbUser(id="usr-3", username="engineer", email="engineer@campusnet.ai", hashed_password=get_password_hash("admin123"), role="Network Engineer", is_active=True),
            DbUser(id="usr-4", username="readonly", email="readonly@campusnet.ai", hashed_password=get_password_hash("admin123"), role="Network Engineer", is_active=True)
        ]
        db.add_all(users)
        db.commit()

    # 2. Seed Devices
    if db.query(DbDevice).count() == 0:
        devices = [
            DbDevice(
                id="dev-fw-1",
                name="srx300 firewall",
                type="firewall",
                ip_address="192.168.1.1",
                mac_address="00:0B:82:11:A3:F1",
                status="online",
                model="Juniper SRX300",
                version="JunOS 21.4R3-S3.4",
                uptime="6 hours",
                health_score=98,
                cpu_usage=14,
                memory_usage=35,
                clients_count=42,
                config={
                    "interfaces": {
                        "ge0": {"enabled": True, "vlan": 0, "speed": "1000Mbps"},
                        "ge1": {"enabled": True, "vlan": 10, "speed": "1000Mbps"},
                        "ge2": {"enabled": True, "vlan": 20, "speed": "1000Mbps"}
                    },
                    "firmwareAutoUpdate": False,
                    "dnsServers": ["1.1.1.1", "8.8.8.8"]
                }
            ),
            DbDevice(
                id="dev-cs-1",
                name="ex4100 router",
                type="core_switch",
                ip_address="192.168.99.2",
                mac_address="00:0B:82:22:B4:02",
                status="online",
                model="Juniper EX4400-24T",
                version="JunOS 22.4R1.10",
                uptime="142 days, 2 hours",
                health_score=99,
                cpu_usage=8,
                memory_usage=42,
                clients_count=42,
                config={"interfaces": {"xe0": {"enabled": True, "vlan": 10}, "xe1": {"enabled": True, "vlan": 20}}, "firmwareAutoUpdate": True}
            ),
            DbDevice(
                id="dev-as-1",
                name="ex2300 switch",
                type="access_switch",
                ip_address="192.168.99.3",
                mac_address="00:0B:82:33:C5:10",
                status="online",
                model="Juniper EX2300-C-12P",
                version="JunOS 21.4R3-S7.6",
                uptime="30 days, 12 hours",
                health_score=95,
                cpu_usage=22,
                memory_usage=51,
                clients_count=28,
                config={"interfaces": {"ge0": {"enabled": True, "vlan": 10, "poe": True}}, "firmwareAutoUpdate": True}
            )
        ]
        db.add_all(devices)
        db.commit()
    else:
        # Update existing dev-as-1 record with correct IP and hardware metadata
        dev = db.query(DbDevice).filter(DbDevice.id == "dev-as-1").first()
        if dev:
            dev.ip_address = "192.168.99.3"
            dev.model = "Juniper EX2300-C-12P"
            dev.version = "JunOS 21.4R3-S7.6"
            db.commit()
            
        # Update existing dev-cs-1 record with correct IP address
        dev_cs = db.query(DbDevice).filter(DbDevice.id == "dev-cs-1").first()
        if dev_cs:
            dev_cs.ip_address = "192.168.99.2"
            db.commit()

    # 3. Seed Clients
    if db.query(DbClient).count() == 0:
        clients = [
            DbClient(id="cli-1", name="Johns-MacBook-Pro", mac_address="F4:0F:24:D1:88:C2", ip_address="10.10.20.101", connection_type="wireless", status="active", rx_rate=425.4, tx_rate=180.2, signal_strength=-58, connected_to_device_id="dev-ap-disc-91cfb1", connected_to_device_name="Indoor-2", vlan_id=20, os="macOS Sonoma", band="5GHz"),
            DbClient(id="cli-2", name="Sara-iPhone-15", mac_address="A2:18:C4:6E:9B:40", ip_address="10.10.30.55", connection_type="wireless", status="active", rx_rate=58.1, tx_rate=12.4, signal_strength=-67, connected_to_device_id="dev-ap-disc-91cfc0", connected_to_device_name="Indoor-1", vlan_id=30, os="iOS 17", band="5GHz")
        ]
        db.add_all(clients)
        db.commit()

    # 4. Seed VLANs
    if db.query(DbVlan).count() == 0:
        vlans = [
            DbVlan(id=10, name="VLAN_MGMT_NET", subnet="10.10.10.0/24", dhcp_range="10.10.10.50 - 10.10.10.250", dns_servers=["1.1.1.1", "8.8.8.8"], active_leases_count=5),
            DbVlan(id=20, name="VLAN_CORP_NET", subnet="10.10.20.0/24", dhcp_range="10.10.20.20 - 10.10.20.254", dns_servers=["10.10.10.10", "1.1.1.1"], active_leases_count=15),
            DbVlan(id=30, name="VLAN_GUEST_NET", subnet="10.10.30.0/24", dhcp_range="10.10.30.10 - 10.10.30.254", dns_servers=["8.8.8.8", "8.8.4.4"], active_leases_count=22)
        ]
        db.add_all(vlans)
        db.commit()

    # 5. Seed DHCP Leases
    if db.query(DbDhcpLease).count() == 0:
        leases = [
            DbDhcpLease(id="lease-2", ip_address="10.10.20.101", mac_address="F4:0F:24:D1:88:C2", client_name="Johns-MacBook-Pro", lease_time="23 hours remaining", vlan_id=20),
            DbDhcpLease(id="lease-3", ip_address="10.10.30.55", mac_address="A2:18:C4:6E:9B:40", client_name="Sara-iPhone-15", lease_time="1 hour remaining", vlan_id=30)
        ]
        db.add_all(leases)
        db.commit()

    # 6. Seed Alerts
    if db.query(DbAlert).count() == 0:
        alerts = [
            DbAlert(id="alert-1", severity="critical", message="Access Point 'CN-AP-03-OFFICE-WEST' is offline. Connection terminated abruptly.", timestamp="2026-07-07T10:10:00Z", device_id="dev-ap-3", device_name="CN-AP-03-OFFICE-WEST", resolved=False, category="device"),
            DbAlert(id="alert-2", severity="warning", message="High CPU load (78%) detected on switch 'CN-AS-02-FLOOR2'. Rogue traffic loop suspected.", timestamp="2026-07-07T10:20:00Z", device_id="dev-as-2", device_name="CN-AS-02-FLOOR2", resolved=False, category="device"),
            DbAlert(id="alert-3", severity="warning", message="Intrusion Detection: Firewall blocked port scan from external host 198.51.100.42.", timestamp="2026-07-07T09:45:00Z", device_id="dev-fw-1", device_name="srx300 firewall", resolved=False, category="security")
        ]
        db.add_all(alerts)
        db.commit()

    # 7. Seed Insights
    if db.query(DbInsight).count() == 0:
        insights = [
            DbInsight(id="insight-1", category="optimization", title="Wi-Fi Channel Optimization", description="Co-channel interference detected on 5GHz band between CN-AP-01-LOBBY and CN-AP-02-CONF-A. Mist RF analytics recommends switching CN-AP-02 to Channel 44 (5.22 GHz) to improve throughput by ~25%.", impact="Medium (Enhances wireless throughput for 24 clients)", status="pending", timestamp="2026-07-07T10:00:00Z", suggested_action="Tune RF channels automatically"),
            DbInsight(id="insight-2", category="anomaly", title="Abnormal Traffic Spike", description="Switch CN-AS-02-FLOOR2 is experiencing a 300% packet rate increase on Port ge2 (Client David-Dell-XPS). Possibility of network loop or malware beaconing.", impact="High (Causes high switch CPU utilization and potential loop)", status="pending", timestamp="2026-07-07T10:15:00Z", suggested_action="Rate-limit port ge2 to 10Mbps or quarantine client"),
            DbInsight(id="insight-3", category="security", title="Outdated Device Firmware", description="Firewall and AP-03 are running firmware versions older than the approved enterprise baseline. Vulnerability CVE-2024-3382 resides in AP-03 firmware version.", impact="High (Security compliance exposure)", status="pending", timestamp="2026-07-07T06:30:00Z", suggested_action="Schedule automatic baseline firmware update")
        ]
        db.add_all(insights)
        db.commit()

from sqlalchemy import Column, Integer, String, Boolean, Float, JSON
from ..core.database import Base

class DbUser(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False) # Super Admin, Network Administrator, Network Engineer
    is_active = Column(Boolean, default=True)

class DbDevice(Base):
    __tablename__ = "devices"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    type = Column(String, nullable=False) # firewall, core_switch, access_switch, access_point
    ip_address = Column(String, nullable=False)
    mac_address = Column(String, unique=True, nullable=False)
    status = Column(String, nullable=False) # online, offline, warning
    model = Column(String, nullable=False)
    version = Column(String, nullable=False)
    uptime = Column(String, nullable=False)
    health_score = Column(Integer, default=100)
    cpu_usage = Column(Integer, default=0)
    memory_usage = Column(Integer, default=0)
    clients_count = Column(Integer, default=0)
    config = Column(JSON, nullable=True) # stores SSID mapping, interfaces layout

class DbClient(Base):
    __tablename__ = "clients"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    mac_address = Column(String, unique=True, nullable=False)
    ip_address = Column(String, nullable=False)
    connection_type = Column(String, nullable=False) # wired, wireless
    status = Column(String, nullable=False) # active, inactive
    rx_rate = Column(Float, default=0.0)
    tx_rate = Column(Float, default=0.0)
    signal_strength = Column(Integer, nullable=True)
    connected_to_device_id = Column(String, nullable=False)
    connected_to_device_name = Column(String, nullable=False)
    vlan_id = Column(Integer, nullable=False)
    os = Column(String, nullable=False)
    band = Column(String, nullable=True)
    ssid = Column(String, nullable=True)

class DbVlan(Base):
    __tablename__ = "vlans"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    subnet = Column(String, nullable=False)
    dhcp_range = Column(String, nullable=False)
    dns_servers = Column(JSON, nullable=False)
    active_leases_count = Column(Integer, default=0)

class DbDhcpLease(Base):
    __tablename__ = "dhcp_leases"
    
    id = Column(String, primary_key=True, index=True)
    ip_address = Column(String, unique=True, nullable=False)
    mac_address = Column(String, unique=True, nullable=False)
    client_name = Column(String, nullable=False)
    lease_time = Column(String, nullable=False)
    vlan_id = Column(Integer, nullable=False)

class DbAlert(Base):
    __tablename__ = "alerts"
    
    id = Column(String, primary_key=True, index=True)
    severity = Column(String, nullable=False) # info, warning, critical
    message = Column(String, nullable=False)
    timestamp = Column(String, nullable=False)
    device_id = Column(String, nullable=True)
    device_name = Column(String, nullable=True)
    resolved = Column(Boolean, default=False)
    category = Column(String, nullable=False) # system, device, security, client

class DbInsight(Base):
    __tablename__ = "insights"
    
    id = Column(String, primary_key=True, index=True)
    category = Column(String, nullable=False) # security, performance, optimization, anomaly
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    impact = Column(String, nullable=False)
    status = Column(String, default="pending") # pending, applied, ignored
    timestamp = Column(String, nullable=False)
    suggested_action = Column(String, nullable=True)

from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any

# Auth
class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str
    role: str

class UserOut(BaseModel):
    id: str
    username: str
    email: EmailStr
    role: str
    is_active: bool

    class Config:
        from_attributes = True

# Device
class DeviceConfigUpdate(BaseModel):
    interfaces: Optional[Dict[str, Any]] = None
    ssids: Optional[List[str]] = None
    firmwareAutoUpdate: Optional[bool] = None
    dnsServers: Optional[List[str]] = None

class DeviceOnboard(BaseModel):
    name: str
    type: str
    model: str
    ipAddress: str
    macAddress: str
    version: str
    status: str
    config: Optional[Dict[str, Any]] = None

class DeviceOut(BaseModel):
    id: str
    name: str
    type: str
    ipAddress: str
    macAddress: str
    status: str
    model: str
    version: str
    uptime: str
    healthScore: int
    cpuUsage: int
    memoryUsage: int
    clientsCount: int
    config: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

# Client
class ClientOut(BaseModel):
    id: str
    name: str
    macAddress: str
    ipAddress: str
    connectionType: str
    status: str
    rxRate: float
    txRate: float
    signalStrength: Optional[int] = None
    connectedToDeviceId: str
    connectedToDeviceName: str
    vlanId: int
    os: str
    band: Optional[str] = None

    class Config:
        from_attributes = True

# VLAN
class VlanCreate(BaseModel):
    id: int
    name: str
    subnet: str
    dhcpRange: str
    dnsServers: List[str]

class VlanOut(BaseModel):
    id: int
    name: str
    subnet: str
    dhcpRange: str
    dnsServers: List[str]
    activeLeasesCount: int

    class Config:
        from_attributes = True

# DHCP
class DhcpReservationCreate(BaseModel):
    id: str
    ipAddress: str
    macAddress: str
    clientName: str
    vlanId: int

class DhcpLeaseOut(BaseModel):
    id: str
    ipAddress: str
    macAddress: str
    clientName: str
    leaseTime: str
    vlanId: int

    class Config:
        from_attributes = True

# Alert
class AlertOut(BaseModel):
    id: str
    severity: str
    message: str
    timestamp: str
    deviceId: Optional[str] = None
    deviceName: Optional[str] = None
    resolved: bool
    category: str

    class Config:
        from_attributes = True

# Insight
class InsightOut(BaseModel):
    id: str
    category: str
    title: str
    description: str
    impact: str
    status: str
    timestamp: str
    suggestedAction: Optional[str] = None

    class Config:
        from_attributes = True

# AI Center
class AiQueryRequest(BaseModel):
    prompt: str

class AiQueryResponse(BaseModel):
    text: str
    data: Optional[Any] = None

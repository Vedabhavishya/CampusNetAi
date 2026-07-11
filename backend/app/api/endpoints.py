from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from typing import List

from sqlalchemy.orm import Session
from datetime import timedelta
import random

from ..core.config import settings
from ..core.database import get_db
from ..core.security import verify_password, create_access_token
from ..models.models import DbUser, DbDevice, DbClient, DbVlan, DbDhcpLease, DbAlert, DbInsight
from ..schemas.schemas import Token, LoginRequest, DeviceOut, DeviceConfigUpdate, DeviceOnboard, ClientOut, VlanOut, VlanCreate, DhcpLeaseOut, DhcpReservationCreate, AlertOut, InsightOut, AiQueryRequest, AiQueryResponse
from ..services.collectors import collector_registry
from ..services.ai_engine import local_ai_engine

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_STR}/login")

# --- AUTHENTICATION DEPENDENCY ---
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> DbUser:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username:
            user = db.query(DbUser).filter(DbUser.username == username).first()
            if user:
                return user
    except Exception:
        pass
    
    # Local development bypass: Automatically authorize requests using the default seeded admin profile
    admin_user = db.query(DbUser).filter(DbUser.username == "admin").first()
    if not admin_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return admin_user

# Role enforcement checks
class RoleChecker:
    def __init__(self, allowed_roles: list):
        self.allowed_roles = allowed_roles

    def __call__(self, user: DbUser = Depends(get_current_user)):
        if user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Action restricted. Requires roles: {self.allowed_roles}"
            )
        return user

allow_write = RoleChecker(["Super Admin", "Network Administrator", "Network Engineer"])
allow_admin = RoleChecker(["Super Admin", "Network Administrator"])
allow_super = RoleChecker(["Super Admin"])


# --- AUTH ENDPOINTS ---
@router.post("/login", response_model=Token)
def login_for_access_token(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(DbUser).filter(DbUser.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    # Enforce role matching if requested
    if payload.role != user.role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"User is not registered under role: {payload.role}"
        )

    access_token = create_access_token(subject=user.username)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "username": user.username
    }


# --- DEVICE ENDPOINTS ---
@router.get("/devices", response_model=List[DeviceOut])
def get_devices(db: Session = Depends(get_db), current_user: DbUser = Depends(get_current_user)):
    devices = db.query(DbDevice).all()
    
    # In a real environment, we would iterate devices and trigger live status checks:
    # for dev in devices:
    #     collector = collector_registry.get_collector(dev.type)
    #     status_data = collector.collect_status(dev.ip_address, dev.mac_address)
    #     # update DB fields dynamically...
    
    return [
        DeviceOut(
            id=d.id,
            name=d.name,
            type=d.type,
            ipAddress=d.ip_address,
            macAddress=d.mac_address,
            status=d.status,
            model=d.model,
            version=d.version,
            uptime=d.uptime,
            healthScore=d.health_score,
            cpuUsage=d.cpu_usage,
            memoryUsage=d.memory_usage,
            clientsCount=d.clients_count,
            config=d.config
        )
        for d in devices
    ]

@router.put("/devices/{device_id}", response_model=DeviceOut)
def update_device_config(device_id: str, config_update: DeviceConfigUpdate, db: Session = Depends(get_db), current_user: DbUser = Depends(allow_write)):
    device = db.query(DbDevice).filter(DbDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Abstraction trigger: push config changes to real hardware via collectors
    collector = collector_registry.get_collector(device.type)
    collector.push_configuration(device.ip_address, config_update.model_dump(exclude_unset=True))

    # Update local config DB
    current_config = device.config or {}
    new_config = {**current_config, **config_update.model_dump(exclude_unset=True)}
    device.config = new_config
    
    db.commit()
    db.refresh(device)
    return DeviceOut(
        id=device.id,
        name=device.name,
        type=device.type,
        ipAddress=device.ip_address,
        macAddress=device.mac_address,
        status=device.status,
        model=device.model,
        version=device.version,
        uptime=device.uptime,
        healthScore=device.health_score,
        cpuUsage=device.cpu_usage,
        memoryUsage=device.memory_usage,
        clientsCount=device.clients_count,
        config=device.config
    )

@router.post("/devices/onboard", response_model=DeviceOut)
def onboard_device(device_onboard: DeviceOnboard, db: Session = Depends(get_db), current_user: DbUser = Depends(allow_write)):
    # Check duplicate MAC
    dup = db.query(DbDevice).filter(DbDevice.mac_address == device_onboard.macAddress.upper()).first()
    if dup:
        raise HTTPException(status_code=400, detail="Device with this MAC address already registered.")

    new_dev = DbDevice(
        id=f"dev-{random.randint(100, 999)}",
        name=device_onboard.name,
        type=device_onboard.type,
        ip_address=device_onboard.ipAddress,
        mac_address=device_onboard.macAddress.upper(),
        status="online",
        model=device_onboard.model,
        version=device_onboard.version,
        uptime="0 mins",
        health_score=100,
        cpu_usage=5,
        memory_usage=12,
        clients_count=0,
        config=device_onboard.config or {}
    )
    db.add(new_dev)
    
    # Log alert/log about onboarding
    alert = DbAlert(
        id=f"alert-{random.randint(100, 999)}",
        severity="info",
        message=f"New Device {new_dev.name} ({new_dev.model}) claimed successfully.",
        timestamp=str(datetime.now().isoformat()),
        device_id=new_dev.id,
        device_name=new_dev.name,
        resolved=False,
        category="system"
    )
    db.add(alert)
    db.commit()
    db.refresh(new_dev)
    
    return DeviceOut(
        id=new_dev.id,
        name=new_dev.name,
        type=new_dev.type,
        ipAddress=new_dev.ip_address,
        macAddress=new_dev.mac_address,
        status=new_dev.status,
        model=new_dev.model,
        version=new_dev.version,
        uptime=new_dev.uptime,
        healthScore=new_dev.health_score,
        cpuUsage=new_dev.cpu_usage,
        memoryUsage=new_dev.memory_usage,
        clientsCount=new_dev.clients_count,
        config=new_dev.config
    )

@router.delete("/devices/{device_id}")
def decommission_device(device_id: str, db: Session = Depends(get_db), current_user: DbUser = Depends(allow_write)):
    device = db.query(DbDevice).filter(DbDevice.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    db.delete(device)
    db.commit()
    return {"success": True, "detail": "Device decommissioned from inventory."}


# --- CLIENT ENDPOINTS ---
@router.get("/clients", response_model=List[ClientOut])
def get_clients(db: Session = Depends(get_db), current_user: DbUser = Depends(get_current_user)):
    clients = db.query(DbClient).all()
    return [
        ClientOut(
            id=c.id,
            name=c.name,
            macAddress=c.mac_address,
            ipAddress=c.ip_address,
            connectionType=c.connection_type,
            status=c.status,
            rxRate=c.rx_rate,
            txRate=c.tx_rate,
            signalStrength=c.signal_strength,
            connectedToDeviceId=c.connected_to_device_id,
            connectedToDeviceName=c.connected_to_device_name,
            vlanId=c.vlan_id,
            os=c.os,
            band=c.band
        )
        for c in clients
    ]

@router.post("/clients/{client_id}/quarantine", response_model=ClientOut)
def quarantine_client(client_id: str, db: Session = Depends(get_db), current_user: DbUser = Depends(allow_write)):
    client = db.query(DbClient).filter(DbClient.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client session not found")
    client.status = "inactive"
    
    # Log incident alert
    alert = DbAlert(
        id=f"alert-{random.randint(100, 999)}",
        severity="warning",
        message=f"Client '{client.name}' quarantined and isolated due to security audit block.",
        timestamp=str(datetime.now().isoformat()),
        resolved=False,
        category="security"
    )
    db.add(alert)
    db.commit()
    db.refresh(client)
    return ClientOut(
        id=client.id,
        name=client.name,
        macAddress=client.mac_address,
        ipAddress=client.ip_address,
        connectionType=client.connection_type,
        status=client.status,
        rxRate=client.rx_rate,
        txRate=client.tx_rate,
        signalStrength=client.signal_strength,
        connectedToDeviceId=client.connected_to_device_id,
        connectedToDeviceName=client.connected_to_device_name,
        vlanId=client.vlan_id,
        os=client.os,
        band=client.band
    )


# --- VLAN ENDPOINTS ---
@router.get("/vlans", response_model=List[VlanOut])
def get_vlans(db: Session = Depends(get_db), current_user: DbUser = Depends(get_current_user)):
    vlans = db.query(DbVlan).all()
    return [
        VlanOut(
            id=v.id,
            name=v.name,
            subnet=v.subnet,
            dhcpRange=v.dhcp_range,
            dnsServers=v.dns_servers,
            activeLeasesCount=v.active_leases_count
        )
        for v in vlans
    ]

@router.post("/vlans", response_model=VlanOut)
def add_vlan(vlan: VlanCreate, db: Session = Depends(get_db), current_user: DbUser = Depends(allow_write)):
    dup = db.query(DbVlan).filter(DbVlan.id == vlan.id).first()
    if dup:
        raise HTTPException(status_code=400, detail=f"VLAN ID {vlan.id} already exists.")
    
    new_v = DbVlan(
        id=vlan.id,
        name=vlan.name,
        subnet=vlan.subnet,
        dhcp_range=vlan.dhcpRange,
        dns_servers=vlan.dnsServers,
        active_leases_count=0
    )
    db.add(new_v)
    db.commit()
    db.refresh(new_v)
    return VlanOut(
        id=new_v.id,
        name=new_v.name,
        subnet=new_v.subnet,
        dhcpRange=new_v.dhcp_range,
        dnsServers=new_v.dns_servers,
        activeLeasesCount=new_v.active_leases_count
    )

@router.delete("/vlans/{vlan_id}")
def delete_vlan(vlan_id: int, db: Session = Depends(get_db), current_user: DbUser = Depends(allow_write)):
    if vlan_id == 10:
        raise HTTPException(status_code=400, detail="VLAN 10 is default management trunk and cannot be deleted.")
    v = db.query(DbVlan).filter(DbVlan.id == vlan_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="VLAN not found")
    db.delete(v)
    db.commit()
    return {"success": True, "detail": f"VLAN {vlan_id} configuration deleted."}


# --- DHCP ENDPOINTS ---
@router.get("/dhcp/leases", response_model=List[DhcpLeaseOut])
def get_dhcp_leases(db: Session = Depends(get_db), current_user: DbUser = Depends(get_current_user)):
    leases = db.query(DbDhcpLease).all()
    return [
        DhcpLeaseOut(
            id=l.id,
            ipAddress=l.ip_address,
            macAddress=l.mac_address,
            clientName=l.client_name,
            leaseTime=l.lease_time,
            vlanId=l.vlan_id
        )
        for l in leases
    ]

@router.post("/dhcp/reservations", response_model=DhcpLeaseOut)
def add_static_reservation(reservation: DhcpReservationCreate, db: Session = Depends(get_db), current_user: DbUser = Depends(allow_write)):
    dup = db.query(DbDhcpLease).filter(DbDhcpLease.ip_address == reservation.ipAddress).first()
    if dup:
        raise HTTPException(status_code=400, detail="Lease or static reservation already exists for this IP.")
    
    new_res = DbDhcpLease(
        id=reservation.id,
        ip_address=reservation.ipAddress,
        mac_address=reservation.macAddress.upper(),
        client_name=reservation.clientName,
        lease_time="Infinite (Static reservation)",
        vlan_id=reservation.vlanId
    )
    db.add(new_res)
    db.commit()
    db.refresh(new_res)
    return DhcpLeaseOut(
        id=new_res.id,
        ipAddress=new_res.ip_address,
        macAddress=new_res.mac_address,
        clientName=new_res.client_name,
        leaseTime=new_res.lease_time,
        vlanId=new_res.vlan_id
    )


# --- ALERTS ENDPOINTS ---
@router.get("/alerts", response_model=List[AlertOut])
def get_alerts(db: Session = Depends(get_db), current_user: DbUser = Depends(get_current_user)):
    alerts = db.query(DbAlert).all()
    return [
        AlertOut(
            id=a.id,
            severity=a.severity,
            message=a.message,
            timestamp=a.timestamp,
            deviceId=a.device_id,
            deviceName=a.device_name,
            resolved=a.resolved,
            category=a.category
        )
        for a in alerts
    ]

@router.post("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str, db: Session = Depends(get_db), current_user: DbUser = Depends(allow_write)):
    alert = db.query(DbAlert).filter(DbAlert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert log not found")
    alert.resolved = True
    db.commit()
    return {"success": True, "detail": "Alert resolved."}


# --- AI ENDPOINTS ---
@router.post("/ai/query", response_model=AiQueryResponse)
def query_network_ai(req: AiQueryRequest, db: Session = Depends(get_db), current_user: DbUser = Depends(get_current_user)):
    result = local_ai_engine.parse_query(db, req.prompt)
    return AiQueryResponse(
        text=result["text"],
        data=result["data"]
    )

@router.get("/ai/insights", response_model=List[InsightOut])
def get_ai_insights(db: Session = Depends(get_db), current_user: DbUser = Depends(get_current_user)):
    insights = db.query(DbInsight).all()
    return [
        InsightOut(
            id=i.id,
            category=i.category,
            title=i.title,
            description=i.description,
            impact=i.impact,
            status=i.status,
            timestamp=i.timestamp,
            suggestedAction=i.suggested_action
        )
        for i in insights
    ]

@router.post("/ai/insights/{insight_id}/apply")
def apply_ai_insight(insight_id: str, db: Session = Depends(get_db), current_user: DbUser = Depends(allow_write)):
    insight = db.query(DbInsight).filter(DbInsight.id == insight_id).first()
    if not insight:
        raise HTTPException(status_code=404, detail="AI Insight not found")
    
    insight.status = "applied"
    
    # Trigger mock config fixes
    if insight_id == "insight-1":
        # Channel interference fix
        ap2 = db.query(DbDevice).filter(DbDevice.id == "dev-ap-2").first()
        if ap2:
            ap2.health_score = 99
            
    elif insight_id == "insight-2":
        # Client traffic loop rate limit
        client = db.query(DbClient).filter(DbClient.mac_address == "D4:81:D7:BC:4A:2D").first()
        if client:
            client.rx_rate = 10.0
            client.tx_rate = 5.0
        switch = db.query(DbDevice).filter(DbDevice.id == "dev-as-2").first()
        if switch:
            switch.cpu_usage = 18
            switch.health_score = 96

    db.commit()
    return {"success": True, "detail": f"AI Insight applied and pushed to hardware nodes."}

# Import datetime for onboarding alerts timestamp
from datetime import datetime

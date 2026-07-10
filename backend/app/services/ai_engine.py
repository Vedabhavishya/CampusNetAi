from typing import Dict, Any, List
from sqlalchemy.orm import Session
from ..models.models import DbDevice, DbClient, DbAlert

class LocalAiEngine:
    """
    Modular Rule-Based AI Engine.
    Processes natural language queries and matches them against simulated telemetry and database records.
    Designed with a clean interface so it can easily be swapped with OpenAI, Gemini, or Claude APIs later.
    """
    def parse_query(self, db: Session, prompt: str) -> Dict[str, Any]:
        query = prompt.lower()
        
        # 1. Query offline devices
        if "offline" in query or "disconnected" in query or "down" in query:
            offline_devices = db.query(DbDevice).filter(DbDevice.status == "offline").all()
            if not offline_devices:
                return {
                    "text": "Currently, all network hardware nodes (Firewalls, Switches, APs) are reporting healthy heartbeats. Uptime averages 98%.",
                    "data": []
                }
            else:
                data_list = [
                    {
                        "id": d.id,
                        "name": d.name,
                        "model": d.model,
                        "status": d.status,
                        "ipAddress": d.ip_address,
                        "macAddress": d.mac_address,
                        "type": d.type
                    }
                    for d in offline_devices
                ]
                return {
                    "text": f"I identified {len(offline_devices)} offline hardware device(s) on the subnet. Summary listing below:",
                    "data": data_list
                }
        
        # 2. Query clients / users
        elif "client" in query or "user" in query or "device session" in query:
            if "john" in query or "macbook" in query:
                john_client = db.query(DbClient).filter(DbClient.name.like("%John%")).first()
                if john_client:
                    return {
                        "text": f"Client **Johns-MacBook-Pro** is connected to AP **{john_client.connected_to_device_name}** on the {john_client.band or '5GHz'} band. Signal strength is strong ({john_client.signal_strength or -58} dBm) with optimal throughput.",
                        "data": {
                            "name": john_client.name,
                            "ipAddress": john_client.ip_address,
                            "macAddress": john_client.mac_address,
                            "os": john_client.os,
                            "connectedToDeviceName": john_client.connected_to_device_name,
                            "signalStrength": john_client.signal_strength,
                            "rxRate": john_client.rx_rate
                        }
                    }
            
            # General clients count
            clients = db.query(DbClient).all()
            data_list = [
                {
                    "id": c.id,
                    "name": c.name,
                    "ipAddress": c.ip_address,
                    "os": c.os,
                    "connectedToDeviceName": c.connected_to_device_name,
                }
                for c in clients
            ]
            wireless_count = sum(1 for c in clients if c.connection_type == "wireless")
            wired_count = sum(1 for c in clients if c.connection_type == "wired")
            return {
                "text": f"Currently, there are {len(clients)} active client sessions registered on the campus network ({wireless_count} wireless Wi-Fi clients and {wired_count} wired Ethernet hosts). Details mapped below:",
                "data": data_list
            }

        # 3. Query Switch or PoE
        elif "switch" in query or "poe" in query or "port" in query:
            switches = db.query(DbDevice).filter(DbDevice.type.like("%switch%")).all()
            data_list = [
                {
                    "name": s.name,
                    "model": s.model,
                    "ipAddress": s.ip_address,
                    "cpuUsage": s.cpu_usage,
                    "healthScore": s.health_score
                }
                for s in switches
            ]
            return {
                "text": f"Managing {len(switches)} switches in the stack. Switch 'CN-AS-02-FLOOR2' is running at moderate CPU load (78%) due to high packet activity on ge2.",
                "data": data_list
            }

        # 4. Query alerts/issues
        elif "alert" in query or "issue" in query or "error" in query or "warning" in query:
            active_alerts = db.query(DbAlert).filter(DbAlert.resolved == False).all()
            if not active_alerts:
                return {
                    "text": "Campus syslog is clear. Zero active alerts or warnings are currently open.",
                    "data": []
                }
            data_list = [
                {
                    "id": a.id,
                    "message": a.message,
                    "severity": a.severity,
                    "timestamp": a.timestamp,
                    "deviceName": a.device_name
                }
                for a in active_alerts
            ]
            return {
                "text": f"There are currently {len(active_alerts)} unresolved active warnings in the notifications queue. Immediate concern: AP-03 is offline.",
                "data": data_list
            }

        # 5. Radio optimization / RF plan
        elif "optimize" in query or "fix" in query or "rf" in query or "radio" in query:
            return {
                "text": "Mist RF optimization analysis: AP-01 and AP-02 are experiencing 5GHz co-channel interference. Applying the channel tuning fix will switch AP-02 to Channel 44 (5.22 GHz), boosting throughput for 24 clients by ~25%. Would you like me to execute this?",
                "data": {"suggested_action": "Tune channels automatically", "impact": "High"}
            }

        # Default help options
        return {
            "text": "I am the CampusNet AI assistant. I audit syslog alerts, inspect active client links, query switch PoE metrics, and push RF channel optimizations. \n\nTry asking me:\n- 'Are there any offline devices?'\n- 'Audit network security alerts'\n- 'Trace John\\'s Macbook details'\n- 'List managed switch nodes'",
            "data": None
        }

local_ai_engine = LocalAiEngine()

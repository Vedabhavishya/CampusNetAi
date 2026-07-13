import asyncio
import os
import time
from sqlalchemy.orm.attributes import flag_modified
from ...core.database import SessionLocal
from ...models.models import DbDevice
from .collector_factory import collector_registry
from .telemetry_cache import telemetry_cache

async def start_scheduler():
    """
    Background polling scheduler running at POLL_INTERVAL.
    """
    try:
        poll_interval = int(os.getenv("POLL_INTERVAL", "10"))
    except ValueError:
        poll_interval = 10

    print(f"[Scheduler] Starting polling scheduler with interval: {poll_interval}s", flush=True)

    while True:
        db = SessionLocal()
        try:
            devices = db.query(DbDevice).all()
            for dev in devices:
                try:
                    collector = collector_registry.get_collector(dev.type)
                    # Poll the collector (uses ip_address, mac_address, config)
                    status_data = collector.collect_status(dev.ip_address, dev.mac_address, dev.config)
                    
                    # Update Memory Cache
                    telemetry_cache.set(dev.id, status_data)

                    # Update Database fields persistently
                    dev.status = status_data.get("status", dev.status)
                    dev.health_score = status_data.get("health_score", dev.health_score)
                    dev.cpu_usage = status_data.get("cpu_usage", dev.cpu_usage)
                    dev.memory_usage = status_data.get("memory_usage", dev.memory_usage)
                    dev.uptime = status_data.get("uptime", dev.uptime)
                    
                    # Update inventory info in database if collector successfully queried it
                    if "inventory" in status_data:
                        inv = status_data["inventory"]
                        dev.model = inv.get("model", dev.model)
                        dev.version = inv.get("junos", dev.version)

                    # Map real telemetry config properties
                    if "telemetry" in status_data and status_data["telemetry"] is not None:
                        telemetry = status_data["telemetry"]
                        current_config = dev.config or {}
                        
                        # Routes mapping
                        if "routes" in telemetry:
                            current_config["routingTable"] = [
                                {
                                    "destination": r["destination"],
                                    "gateway": r["gateway"],
                                    "interface": r["interface"]
                                }
                                for r in telemetry["routes"]
                            ]
                        
                        # Interfaces mapping
                        if "interfaces" in telemetry:
                            if "interfaces" not in current_config:
                                current_config["interfaces"] = {}
                            for i in telemetry["interfaces"]:
                                iface_name = i["interface"]
                                current_config["interfaces"][iface_name] = {
                                    "enabled": i["admin"] == "up",
                                    "link": i["link"],
                                    "ip": i["ip"],
                                    "speed": "1000Mbps"
                                }
                        
                        # Zones mapping
                        if "zones" in telemetry:
                            current_config["securityZones"] = telemetry["zones"]
                        
                        # Policies mapping
                        if "policies" in telemetry:
                            current_config["firewallPolicies"] = [
                                {
                                    "id": f"pol-{idx}",
                                    "name": p["policyName"],
                                    "srcZone": p["fromZone"],
                                    "destZone": p["toZone"],
                                    "service": "Any",
                                    "action": "permit" if "permit" in p["state"].lower() else "deny",
                                    "enabled": p["state"] == "enabled" or p["state"] == "active"
                                }
                                for idx, p in enumerate(telemetry["policies"], start=1)
                            ]
                            
                        dev.config = current_config
                        flag_modified(dev, "config")

                    if "telemetry" in status_data and status_data["telemetry"] is not None:
                        if "radios" in status_data["telemetry"]:
                            radios = status_data["telemetry"]["radios"]
                            total_clients = sum(r.get("active_clients", 0) for r in radios.values())
                            dev.clients_count = total_clients

                except Exception as ex:
                    print(f"[Scheduler] Failed to update device {dev.name}: {ex}", flush=True)
            db.commit()
        except Exception as e:
            print(f"[Scheduler Database Error] {e}", flush=True)
        finally:
            db.close()
        
        await asyncio.sleep(poll_interval)

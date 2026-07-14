import asyncio
import os
import time
import re
from sqlalchemy.orm.attributes import flag_modified
from ...core.database import SessionLocal
from ...models.models import DbDevice
from .collector_factory import collector_registry
from .telemetry_cache import telemetry_cache
from ..interface_utils import is_physical_switch_port
from ..correlators.network_correlator import NetworkCorrelator
from ..telemetry_validator import validate_telemetry
from ..telemetry_merger import merge_telemetry
from ..health_utils import calculate_device_health

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
        cycle_start_time = time.time()
        print("[Scheduler] Starting polling cycle...", flush=True)
        
        db = SessionLocal()
        try:
            devices = db.query(DbDevice).filter(DbDevice.type != "access_point").all()
            for dev in devices:
                try:
                    collector = collector_registry.get_collector(dev.type, dev.model)
                    
                    # 1. Collect
                    if dev.type == "access_point":
                        status_data = collector.collect_status(dev.ip_address, dev.mac_address, dev.config, device_id=dev.id, db=db)
                    else:
                        status_data = collector.collect_status(dev.ip_address, dev.mac_address, dev.config, device_id=dev.id)
                    
                    # Correct collector metadata dynamically without modifying collector implementation
                    if "collector" in status_data and isinstance(status_data["collector"], dict):
                        status_data["collector"]["name"] = collector.__class__.__name__

                    # 2. Correlate (APs only, linking EX2300 switch ports and PoE details)
                    if dev.type == "access_point":
                        switch_cached = telemetry_cache.get("dev-as-1") or {}
                        if "telemetry" in status_data:
                            status_data["telemetry"] = NetworkCorrelator.correlate_wireless(
                                status_data["telemetry"], 
                                switch_cached
                            )

                    # 3. Validate
                    validate_telemetry(dev.type, status_data.get("telemetry", {}))

                    # 4. Merge incoming data with existing cache data
                    existing_data = telemetry_cache.get(dev.id) or {}
                    status_data = merge_telemetry(existing_data, status_data)

                    # 5. Calculate Health on the fully merged and correlated telemetry
                    status_data["health_score"] = calculate_device_health(dev.type, status_data.get("telemetry", {}))
                    if "telemetry" in status_data and status_data["telemetry"] is not None:
                        status_data["telemetry"]["health_score"] = status_data["health_score"]

                    # 6. Store in Cache
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
                            new_interfaces = {}
                            interfaces_config = current_config.get("interfaces", {})
                            
                            # Determine order of interfaces: preserve list order, sort dict naturally
                            raw_list = telemetry["interfaces"]
                            if isinstance(raw_list, dict):
                                sorted_keys = sorted(
                                    raw_list.keys(),
                                    key=lambda x: int(re.search(r"(\d+)$", x).group(1)) if re.search(r"(\d+)$", x) else 0
                                )
                                sorted_items = [{"interface": k, **(raw_list[k] if isinstance(raw_list[k], dict) else {})} for k in sorted_keys]
                            elif isinstance(raw_list, list):
                                sorted_items = raw_list
                            else:
                                sorted_items = []
                                
                            available_interfaces = [item["interface"] for item in sorted_items if isinstance(item, dict) and "interface" in item]
                            
                            for i in sorted_items:
                                if not isinstance(i, dict) or "interface" not in i:
                                    continue
                                iface_name = i["interface"]
                                
                                # Skip non-configurable physical switch ports
                                if not is_physical_switch_port(iface_name, available_interfaces):
                                    continue
                                    
                                existing = interfaces_config.get(iface_name, {})
                                new_interfaces[iface_name] = {
                                    **existing,
                                    "enabled": i["admin"] == "up",
                                    "link": i["link"],
                                    "ip": i["ip"],
                                    "speed": existing.get("speed", "1000Mbps")
                                }
                            current_config["interfaces"] = new_interfaces
                        
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
                        if dev.type == "access_point":
                            dev.clients_count = status_data["telemetry"].get("connected_clients_count", 0)
                        elif "radios" in status_data["telemetry"]:
                            radios = status_data["telemetry"]["radios"]
                            total_clients = sum(r.get("active_clients", 0) for r in radios.values())
                            dev.clients_count = total_clients

                except Exception as ex:
                    import traceback
                    traceback.print_exc()
                    print(f"[Scheduler] Failed to update device {dev.name}: {ex}", flush=True)

            pass
            
            db.commit()
        except Exception as e:
            print(f"[Scheduler Database Error] {e}", flush=True)
        finally:
            db.close()
        
        cycle_duration = time.time() - cycle_start_time
        try:
            current_interval = int(os.getenv("POLL_INTERVAL", str(poll_interval)))
        except ValueError:
            current_interval = poll_interval
            
        print(f"[Scheduler] Polling cycle finished in {cycle_duration:.2f}s. Sleeping for {current_interval}s before next cycle.", flush=True)
        await asyncio.sleep(current_interval)


async def start_mist_scheduler():
    """
    Dedicated fast polling scheduler for Mist Access Points and Clients.
    Runs every 5 seconds.
    """
    print("[Scheduler] Starting fast Mist polling scheduler (5s interval)", flush=True)
    while True:
        cycle_start = time.time()
        db = SessionLocal()
        try:
            collector = collector_registry.get_collector("access_point")
            if collector:
                # Direct live fetch
                has_live = collector._fetch_mist_data()
                if has_live:
                    collector._sync_database_records(db)
                
                # Query access points (now populated/discovered!)
                devices = db.query(DbDevice).filter(DbDevice.type == "access_point").all()
                
                # Update each AP cache and DB fields
                for dev in devices:
                    status_data = collector.collect_status(dev.ip_address, dev.mac_address, dev.config, device_id=dev.id)
                    
                    # Correlate
                    switch_cached = telemetry_cache.get("dev-as-1") or {}
                    if "telemetry" in status_data:
                        status_data["telemetry"] = NetworkCorrelator.correlate_wireless(
                            status_data["telemetry"], 
                            switch_cached
                        )
                    
                    # Validate, Merge, Health
                    validate_telemetry(dev.type, status_data.get("telemetry", {}))
                    existing = telemetry_cache.get(dev.id) or {}
                    status_data = merge_telemetry(existing, status_data)
                    status_data["health_score"] = calculate_device_health(dev.type, status_data.get("telemetry", {}))
                    if "telemetry" in status_data and status_data["telemetry"] is not None:
                        status_data["telemetry"]["health_score"] = status_data["health_score"]
                        dev.clients_count = status_data["telemetry"].get("connected_clients_count", 0)
                        
                    telemetry_cache.set(dev.id, status_data)
                    
                    dev.status = status_data.get("status", dev.status)
                    dev.health_score = status_data.get("health_score", dev.health_score)
                    dev.cpu_usage = status_data.get("cpu_usage", dev.cpu_usage)
                    dev.memory_usage = status_data.get("memory_usage", dev.memory_usage)
                    dev.uptime = status_data.get("uptime", dev.uptime)
                
                # Cache site-wide stats
                site_data = {
                    "site_id": os.getenv("MIST_SITE_ID", "Primary-Site"),
                    "site_name": "Primary Campus Site",
                    "clients": collector.get_site_clients(),
                    "wlans": collector.get_site_wlans(),
                    "connection": collector.get_connection_stats(),
                    "last_poll": collector.last_poll
                }
                telemetry_cache.set("wireless_site_data", site_data)
                print(
                    f"[Scheduler] Cached site-wide wireless telemetry: "
                    f"clients={len(site_data['clients'])}, wlans={len(site_data['wlans'])}, "
                    f"status={site_data['connection']['status']}",
                    flush=True
                )
                
            db.commit()
        except Exception as e:
            print(f"[Mist Scheduler Error] {e}", flush=True)
        finally:
            db.close()
            
        # Run every 5 seconds (accounting for execution time)
        elapsed = time.time() - cycle_start
        sleep_time = max(0.5, 5.0 - elapsed)
        await asyncio.sleep(sleep_time)

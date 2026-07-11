from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.database import engine, Base, SessionLocal
from .core.seed import seed_database
from .api.endpoints import router as api_router

# Create Database tables
try:
    Base.metadata.create_all(bind=engine)
    print("Database tables initialized successfully.")
except Exception as e:
    print(f"Warning: Database metadata tables generation failed: {e}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_STR}/openapi.json"
)

# Enable CORS for Vite frontend local dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import asyncio
from .services.collectors import collector_registry

async def poll_devices_periodically():
    while True:
        db = SessionLocal()
        try:
            devices = db.query(DbDevice).all()
            for dev in devices:
                try:
                    collector = collector_registry.get_collector(dev.type)
                    status_data = collector.collect_status(dev.ip_address, dev.mac_address, dev.config)
                    
                    dev.status = status_data.get("status", dev.status)
                    dev.health_score = status_data.get("health_score", dev.health_score)
                    dev.cpu_usage = status_data.get("cpu_usage", dev.cpu_usage)
                    dev.memory_usage = status_data.get("memory_usage", dev.memory_usage)
                    dev.uptime = status_data.get("uptime", dev.uptime)
                    
                    # Map real telemetry config properties for physical devices
                    if "telemetry" in status_data:
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
                            
                        from sqlalchemy.orm.attributes import flag_modified
                        dev.config = current_config
                        flag_modified(dev, "config")

                    if "telemetry" in status_data and "radios" in status_data["telemetry"]:
                        radios = status_data["telemetry"]["radios"]
                        total_clients = sum(r.get("active_clients", 0) for r in radios.values())
                        dev.clients_count = total_clients
                except Exception as ex:
                    print(f"[Polling Daemon Error] Failed to update device {dev.name}: {ex}")
            db.commit()
        except Exception as e:
            print(f"[Polling Daemon Database Error] {e}")
        finally:
            db.close()
        
        await asyncio.sleep(5)  # Poll every 5 seconds

# Initialize seed data
@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        seed_database(db)
        print("Telemetry database seeded successfully.")
    except Exception as e:
        print(f"Warning: Telemetry seeding failed: {e}")
    finally:
        db.close()
    
    # Start the local network polling task
    asyncio.create_task(poll_devices_periodically())

# Include API Router
app.include_router(api_router, prefix=settings.API_STR)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "controller": settings.PROJECT_NAME,
        "docs_url": "/docs"
    }

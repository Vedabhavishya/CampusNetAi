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
        
        await asyncio.sleep(15)  # Poll every 15 seconds

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

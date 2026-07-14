from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .core.database import engine, Base, SessionLocal
from .core.seed import seed_database
from .api.endpoints import router as api_router
from .models.models import DbDevice

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
from .services.collectors import collector_registry, start_scheduler, start_mist_scheduler

# Background polling daemon is now handled by the services.collectors scheduler module

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
    
    # Start the local network polling task scheduler in a background daemon thread
    import threading
    def run_scheduler_in_thread():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.create_task(start_scheduler())
        loop.create_task(start_mist_scheduler())
        loop.run_forever()
        
    threading.Thread(target=run_scheduler_in_thread, daemon=True).start()

# Include API Router
app.include_router(api_router, prefix=settings.API_STR)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "controller": settings.PROJECT_NAME,
        "docs_url": "/docs"
    }

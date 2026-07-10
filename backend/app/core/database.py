from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# If using SQLite, we need connect_args={"check_same_thread": False}
is_sqlite = settings.DATABASE_URL.startswith("sqlite")

try:
    if is_sqlite:
        engine = create_engine(
            settings.DATABASE_URL, connect_args={"check_same_thread": False}
        )
    else:
        engine = create_engine(
            settings.DATABASE_URL, pool_pre_ping=True
        )
except Exception as e:
    print(f"Warning: Failed to connect to DB engine: {settings.DATABASE_URL}. Falling back to local SQLite database.")
    engine = create_engine("sqlite:///./campusnet_fallback.db", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "CampusNet AI Controller")
    API_STR: str = os.getenv("API_STR", "/api/v1")
    
    SECRET_KEY: str = os.getenv("SECRET_KEY", "campusnet_ai_super_secret_cryptography_key_change_me_in_production")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))
    
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./campusnet.db")

settings = Settings()

import os
from dotenv import load_dotenv

# Load env variables from the active environment
load_dotenv()

class Settings:
    PROJECT_NAME: str = "SinyalIDX FastAPI Backend Bridge"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Database URLs
    LOCAL_DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "postgresql://openpg:openpgpwd@localhost:5432/stock"
    )
    
    REMOTE_DATABASE_URL: str = os.getenv(
        "REMOTE_DATABASE_URL", 
        "postgresql://postgres:newpassword@62.171.183.236:5434/broker_db"
    )
    
    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "your_jwt_secret_change_this_in_production")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days as in legacy Node JWT_EXPIRATION=7d
    
    # OpenRouter API Key
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    AI_MODEL: str = "google/gemini-2.0-flash-001"

settings = Settings()

import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "SinyalIDX FastAPI Backend Bridge"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    LOCAL_DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://openpg:openpgpwd@localhost:5432/stock"
    )

    REMOTE_DATABASE_URL: str = os.getenv(
        "REMOTE_DATABASE_URL",
        "postgresql://postgres:newpassword@62.171.183.236:5434/broker_db"
    )

    JWT_SECRET: str = os.getenv("JWT_SECRET", "your_jwt_secret_change_this_in_production")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    AI_MODEL: str = "google/gemini-2.5-flash"

    MIDTRANS_SERVER_KEY: str = os.getenv("MIDTRANS_SERVER_KEY", "")
    MIDTRANS_CLIENT_KEY: str = os.getenv("MIDTRANS_CLIENT_KEY", "")
    MIDTRANS_IS_PRODUCTION: bool = os.getenv("MIDTRANS_IS_PRODUCTION", "false").lower() == "true"
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "https://idx.mytriv.com")

settings = Settings()

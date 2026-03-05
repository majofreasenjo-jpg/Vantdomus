from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    DB_PATH: str = str(Path(__file__).resolve().parents[1] / "vantdomus.db")
    DATABASE_URL: str | None = None
    JWT_SECRET: str = "CHANGE_ME_SUPER_SECRET"
    JWT_ALG: str = "HS256"
    ACCESS_TOKEN_EXPIRES_SECONDS: int = 3600

settings = Settings()

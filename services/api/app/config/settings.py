from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    b2_endpoint: str = ""
    b2_region: str = ""
    b2_key_id: str = ""
    b2_application_key: str = ""
    b2_bucket_name: str = ""

    gmi_api_key: str = ""

    nextauth_secret: str = ""


settings = Settings()

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    gemini_api_key: str = ""
    gmail_address: str = ""
    gmail_app_password: str = ""
    approver_email: str = ""
    public_base_url: str = "http://localhost:3000"
    storage_dir: str = "/app/storage"
    inbox_dir: str = "/app/inbox"


settings = Settings()

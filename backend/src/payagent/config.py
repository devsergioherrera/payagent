from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    database_url: str
    gemini_api_key: str = ""
    gmail_address: str = ""
    gmail_app_password: str = ""
    approver_email: str = ""
    imap_poll_seconds: int = 10
    # Deploying only needs DOMAIN; PUBLIC_BASE_URL is for anything else (e.g. a tunnel URL).
    domain: str = ""
    public_base_url: str = ""
    # Relative to backend/ for local runs; docker-compose sets /app/storage and /app/inbox.
    admin_password: str = ""
    session_secret: str = ""
    admin_name: str = "Sergio"
    storage_dir: str = "../storage"
    inbox_dir: str = "../inbox"

    @model_validator(mode="after")
    def _derive(self) -> "Settings":
        if not self.public_base_url:
            self.public_base_url = f"https://{self.domain}" if self.domain else "http://localhost"
        self.public_base_url = self.public_base_url.rstrip("/")
        # Google shows app passwords as "abcd efgh ijkl mnop".
        self.gmail_app_password = self.gmail_app_password.replace(" ", "")
        return self


settings = Settings()

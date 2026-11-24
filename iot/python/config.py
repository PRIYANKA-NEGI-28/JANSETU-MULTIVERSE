import os
from pathlib import Path
from pydantic import Field, field_validator
from pydantic import BaseModel
from dotenv import load_dotenv

env_path = Path(__file__).parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()


class Config(BaseModel):
    """JanSetu IoT Edge Gateway configuration loaded from environment variables."""

    # Backend API endpoint URL (Strictly environment-driven, NO hardcoded Render URLs)
    backend_url: str = Field(
        default_factory=lambda: os.getenv("BACKEND_URL", "http://localhost:3000")
    )

    # Hardware Device Identifiers
    device_uid: str = Field(
        default_factory=lambda: os.getenv("DEVICE_UID", os.getenv("DEVICE_ID", "UNO_Q_01"))
    )

    # Cryptographic HMAC-SHA256 signing secret
    device_hmac_secret: str = Field(
        default_factory=lambda: os.getenv("DEVICE_HMAC_SECRET", "jansetu-iot-dev-secret")
    )

    # Operational Timers (Seconds)
    poll_interval_sec: float = Field(
        default_factory=lambda: float(os.getenv("POLL_INTERVAL_SEC", "1.0"))
    )
    heartbeat_interval_sec: float = Field(
        default_factory=lambda: float(os.getenv("HEARTBEAT_INTERVAL_SEC", "300.0"))
    )
    request_timeout: float = Field(
        default_factory=lambda: float(os.getenv("REQUEST_TIMEOUT", "10.0"))
    )
    max_backoff_delay: float = Field(
        default_factory=lambda: float(os.getenv("MAX_BACKOFF_DELAY", "60.0"))
    )

    # Storage and Logging
    outbox_db_path: str = Field(
        default_factory=lambda: os.getenv("OUTBOX_DB_PATH", "outbox.db")
    )
    log_level: str = Field(
        default_factory=lambda: os.getenv("LOG_LEVEL", "INFO")
    )
    log_file_path: str = Field(
        default_factory=lambda: os.getenv("LOG_FILE_PATH", "jansetu_iot.log")
    )
    max_log_bytes: int = Field(
        default_factory=lambda: int(os.getenv("MAX_LOG_BYTES", "1048576"))  # 1 MB
    )
    log_backup_count: int = Field(
        default_factory=lambda: int(os.getenv("LOG_BACKUP_COUNT", "3"))
    )

    # API Routes
    event_endpoint_path: str = Field(
        default_factory=lambda: os.getenv("EVENT_ENDPOINT_PATH", "/api/sensor")
    )

    @field_validator("backend_url")
    @classmethod
    def clean_backend_url(cls, v: str) -> str:
        return v.rstrip("/")

    @property
    def event_url(self) -> str:
        return f"{self.backend_url}{self.event_endpoint_path}"

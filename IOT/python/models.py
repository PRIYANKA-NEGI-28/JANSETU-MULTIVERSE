import time
from typing import Optional
from pydantic import BaseModel, Field


class McuTelemetry(BaseModel):
    """Normalized telemetry payload returned from Arduino UNO Q MCU."""
    state: str
    ldr_raw: int
    seq: int
    uptime_ms: int
    fault_duration_ms: int = 0


class IotEventPayload(BaseModel):
    """Event payload submitted to JanSetu backend upon streetlight state change."""
    device_id: str
    status: str  # "FAULT" | "RESOLVED" | "NORMAL"
    type: str = "STREETLIGHT"
    idempotency_key: str
    seq: int
    uptime_ms: int
    ldr_raw: int
    fault_duration_ms: int = 0
    timestamp: int = Field(default_factory=lambda: int(time.time()))


class IotHeartbeatPayload(BaseModel):
    """Lightweight periodic heartbeat sent every 5 minutes."""
    device_id: str
    status: str = "HEALTHY"  # "HEALTHY" | "FAULT" | "DEGRADED"
    state: str
    uptime_ms: int
    ldr_raw: int
    seq: int
    timestamp: int = Field(default_factory=lambda: int(time.time()))

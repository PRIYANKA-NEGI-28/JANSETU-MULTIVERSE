#!/usr/bin/env python3
"""
JanSetu IoT Edge Gateway Daemon
Target: Linux MPU (Arduino UNO Q / Debian Linux)

Architecture:
- Polls MCU Finite State Machine via RouterBridge RPC.
- SQLite Store-and-Forward Outbox for offline buffering and zero event loss.
- HMAC-SHA256 request signing with strict TLS verification.
- Periodic 5-minute health/telemetry heartbeats.
- Rotating log management protecting eMMC/SD storage from exhaustion.
- Clean signal interception (SIGINT, SIGTERM).
"""

import json
import logging
import signal
import sys
import time
from typing import Optional

from config import Config
from logger import setup_logger
from models import IotEventPayload, IotHeartbeatPayload, McuTelemetry
from outbox import SqliteOutbox
from poller import McuPoller
from client import EdgeHttpClient
from sender import OutboxSender


class JanSetuEdgeDaemon:
    def __init__(self, config: Optional[Config] = None, poller: Optional[McuPoller] = None):
        self.config = config or Config()
        self.logger = setup_logger(
            log_level=self.config.log_level,
            log_file_path=self.config.log_file_path,
            max_bytes=self.config.max_log_bytes,
            backup_count=self.config.log_backup_count,
        )

        self.outbox = SqliteOutbox(db_path=self.config.outbox_db_path)
        self.client = EdgeHttpClient(
            device_uid=self.config.device_uid,
            device_hmac_secret=self.config.device_hmac_secret,
            timeout=self.config.request_timeout,
            verify_ssl=True,
        )
        self.sender = OutboxSender(
            outbox=self.outbox,
            client=self.client,
            event_url=self.config.event_url,
            max_backoff_delay=self.config.max_backoff_delay,
        )
        self.poller = poller or McuPoller()

        self.last_confirmed_state: Optional[str] = None
        self.last_heartbeat_time = 0.0
        self.running = False

    def handle_signal(self, signum, frame):
        self.logger.info("Intercepted signal %s. Initiating graceful shutdown...", signum)
        self.stop()

    def start(self) -> None:
        self.running = True
        signal.signal(signal.SIGINT, self.handle_signal)
        signal.signal(signal.SIGTERM, self.handle_signal)

        self.logger.info("==================================================")
        self.logger.info(" JanSetu IoT Edge MPU Agent Starting             ")
        self.logger.info(" Device UID:      %s", self.config.device_uid)
        self.logger.info(" Backend URL:     %s", self.config.backend_url)
        self.logger.info(" Event Endpoint:  %s", self.config.event_url)
        self.logger.info(" Poll Interval:   %.1fs | Heartbeat: %.1fs",
                         self.config.poll_interval_sec, self.config.heartbeat_interval_sec)
        self.logger.info("==================================================")

        self.sender.start()
        self.last_heartbeat_time = time.time()

        try:
            while self.running:
                self.step()
                time.sleep(self.config.poll_interval_sec)
        finally:
            self.stop()

    def step(self, current_time: Optional[float] = None) -> None:
        """Executes a single step: polls MCU and checks heartbeat."""
        now = current_time if current_time is not None else time.time()

        # 1. Poll MCU state
        telemetry = self.poller.poll()
        if telemetry:
            self._handle_telemetry(telemetry, now)

        # 2. Check periodic heartbeat
        if (now - self.last_heartbeat_time) >= self.config.heartbeat_interval_sec:
            self._send_heartbeat(telemetry, now)
            self.last_heartbeat_time = now

    def _handle_telemetry(self, telemetry: McuTelemetry, now: float) -> None:
        state = telemetry.state

        # State transition into FAULT_CONFIRMED
        if state == "FAULT_CONFIRMED" and self.last_confirmed_state != "FAULT_CONFIRMED":
            idempotency_key = f"{self.config.device_uid}:{telemetry.seq}:FAULT"
            payload = IotEventPayload(
                device_id=self.config.device_uid,
                status="FAULT",
                type="STREETLIGHT",
                idempotency_key=idempotency_key,
                seq=telemetry.seq,
                uptime_ms=telemetry.uptime_ms,
                ldr_raw=telemetry.ldr_raw,
                fault_duration_ms=telemetry.fault_duration_ms,
                timestamp=int(now),
            )
            self.logger.warning("FSM FAULT_CONFIRMED detected! Enqueueing fault event (seq=%d)", telemetry.seq)
            self.outbox.enqueue(
                idempotency_key=idempotency_key,
                device_uid=self.config.device_uid,
                event_type="FAULT_CONFIRMED",
                payload=payload.model_dump(),
                current_time=now,
            )
            self.last_confirmed_state = "FAULT_CONFIRMED"

        # State transition from FAULT_CONFIRMED back to NORMAL (Auto-repair or physical reset)
        elif state == "NORMAL" and self.last_confirmed_state == "FAULT_CONFIRMED":
            idempotency_key = f"{self.config.device_uid}:{telemetry.seq}:RESOLVED"
            payload = IotEventPayload(
                device_id=self.config.device_uid,
                status="RESOLVED",
                type="STREETLIGHT",
                idempotency_key=idempotency_key,
                seq=telemetry.seq,
                uptime_ms=telemetry.uptime_ms,
                ldr_raw=telemetry.ldr_raw,
                fault_duration_ms=0,
                timestamp=int(now),
            )
            self.logger.info("FSM repair / light restoration detected! Enqueueing resolution event (seq=%d)", telemetry.seq)
            self.outbox.enqueue(
                idempotency_key=idempotency_key,
                device_uid=self.config.device_uid,
                event_type="FAULT_CLEARED",
                payload=payload.model_dump(),
                current_time=now,
            )
            self.last_confirmed_state = "NORMAL"

    def _send_heartbeat(self, telemetry: Optional[McuTelemetry], now: float) -> None:
        """Sends signed lightweight heartbeat to backend."""
        state = telemetry.state if telemetry else (self.last_confirmed_state or "NORMAL")
        uptime_ms = telemetry.uptime_ms if telemetry else int(now * 1000)
        ldr_raw = telemetry.ldr_raw if telemetry else 0
        seq = telemetry.seq if telemetry else 0

        heartbeat = IotHeartbeatPayload(
            device_id=self.config.device_uid,
            status="FAULT" if state == "FAULT_CONFIRMED" else "HEALTHY",
            state=state,
            uptime_ms=uptime_ms,
            ldr_raw=ldr_raw,
            seq=seq,
            timestamp=int(now),
        )

        body_str = json.dumps(heartbeat.model_dump(), separators=(",", ":"), sort_keys=True)
        self.logger.info("Transmitting 5-minute heartbeat (state=%s, uptime=%dms)", state, uptime_ms)

        # Heartbeat is transmitted directly over signed HTTP
        success, status_code, msg = self.client.send_signed_post(self.config.event_url, body_str)
        if success:
            self.logger.debug("Heartbeat delivered [HTTP %d]", status_code)
        else:
            self.logger.warning("Heartbeat delivery failed [%s]", msg)

    def stop(self) -> None:
        if not self.running:
            return
        self.running = False
        self.logger.info("Flushing remaining outbox items before shutdown...")
        self.sender.flush_once()
        self.sender.stop()
        self.client.close()
        self.logger.info("JanSetu IoT Edge MPU Agent safely shut down.")


if __name__ == "__main__":
    daemon = JanSetuEdgeDaemon()
    daemon.start()

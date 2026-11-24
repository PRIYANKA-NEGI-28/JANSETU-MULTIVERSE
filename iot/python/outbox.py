import json
import logging
import random
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger("jansetu_iot.outbox")


@dataclass
class OutboxRecord:
    id: int
    idempotency_key: str
    device_uid: str
    event_type: str
    payload_json: str
    created_at: float
    status: str
    retry_count: int
    next_retry_at: float
    last_error: Optional[str]


class SqliteOutbox:
    """
    Store-and-forward SQLite persistence engine.
    Ensures that state transitions are never lost across power cuts or network drops.
    """

    def __init__(self, db_path: str = "outbox.db"):
        self.db_path = db_path
        self._ensure_db_dir()
        self._init_db()

    def _ensure_db_dir(self) -> None:
        parent = Path(self.db_path).parent
        if str(parent) not in ("", "."):
            parent.mkdir(parents=True, exist_ok=True)

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        # Enable WAL (Write-Ahead Logging) for flash write endurance and crash resilience
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._get_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS outbox_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    idempotency_key TEXT UNIQUE NOT NULL,
                    device_uid TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    status TEXT NOT NULL DEFAULT 'PENDING',
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    next_retry_at REAL NOT NULL DEFAULT 0,
                    last_error TEXT
                );
                """
            )
            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_outbox_pending
                ON outbox_events (status, next_retry_at);
                """
            )
            conn.commit()

    def enqueue(
        self,
        idempotency_key: str,
        device_uid: str,
        event_type: str,
        payload: dict,
        current_time: Optional[float] = None,
    ) -> bool:
        """
        Idempotently inserts an event record.
        Returns True if newly inserted, False if duplicate already existed.
        """
        payload_str = json.dumps(payload, separators=(",", ":"), sort_keys=True)
        now = current_time if current_time is not None else time.time()
        try:
            with self._get_connection() as conn:
                cursor = conn.execute(
                    """
                    INSERT OR IGNORE INTO outbox_events (
                        idempotency_key, device_uid, event_type, payload_json,
                        created_at, status, retry_count, next_retry_at
                    ) VALUES (?, ?, ?, ?, ?, 'PENDING', 0, ?);
                    """,
                    (idempotency_key, device_uid, event_type, payload_str, now, now),
                )
                conn.commit()
                if cursor.rowcount > 0:
                    logger.info("Enqueued outbox event '%s' [key=%s]", event_type, idempotency_key)
                    return True
                else:
                    logger.debug("Duplicate event ignored [key=%s]", idempotency_key)
                    return False
        except sqlite3.Error as e:
            logger.error("Failed to enqueue event: %s", e)
            return False

    def get_pending(self, limit: int = 10, current_time: Optional[float] = None) -> List[OutboxRecord]:
        """Fetches pending events whose next_retry_at is <= current_time."""
        now = current_time if current_time is not None else time.time()
        try:
            with self._get_connection() as conn:
                cursor = conn.execute(
                    """
                    SELECT id, idempotency_key, device_uid, event_type, payload_json,
                           created_at, status, retry_count, next_retry_at, last_error
                    FROM outbox_events
                    WHERE status = 'PENDING' AND next_retry_at <= ?
                    ORDER BY id ASC
                    LIMIT ?;
                    """,
                    (now, limit),
                )
                rows = cursor.fetchall()
                return [
                    OutboxRecord(
                        id=row["id"],
                        idempotency_key=row["idempotency_key"],
                        device_uid=row["device_uid"],
                        event_type=row["event_type"],
                        payload_json=row["payload_json"],
                        created_at=row["created_at"],
                        status=row["status"],
                        retry_count=row["retry_count"],
                        next_retry_at=row["next_retry_at"],
                        last_error=row["last_error"],
                    )
                    for row in rows
                ]
        except sqlite3.Error as e:
            logger.error("Failed to query pending outbox: %s", e)
            return []

    def mark_sent(self, record_id: int) -> None:
        """Marks event as successfully delivered."""
        try:
            with self._get_connection() as conn:
                conn.execute(
                    "UPDATE outbox_events SET status = 'SENT', last_error = NULL WHERE id = ?;",
                    (record_id,),
                )
                conn.commit()
                logger.debug("Marked outbox event #%d as SENT", record_id)
        except sqlite3.Error as e:
            logger.error("Failed to mark record #%d as SENT: %s", record_id, e)

    def mark_failed(
        self,
        record_id: int,
        error_msg: str,
        current_retry_count: int,
        max_backoff_delay: float = 60.0,
        current_time: Optional[float] = None,
    ) -> float:
        """
        Updates retry count and calculates next_retry_at with exponential backoff + jitter:
        delay = min(2^retry * 1.0, max_backoff) * (1.0 + uniform(-0.2, 0.2))
        """
        now = current_time if current_time is not None else time.time()
        new_retry = current_retry_count + 1

        # Exponential backoff base
        base_delay = min(2.0 ** min(new_retry, 6), max_backoff_delay)
        # Jitter: +/- 20%
        jitter = random.uniform(0.8, 1.2)
        actual_delay = min(base_delay * jitter, max_backoff_delay)
        next_retry_at = now + actual_delay

        try:
            with self._get_connection() as conn:
                conn.execute(
                    """
                    UPDATE outbox_events
                    SET retry_count = ?, next_retry_at = ?, last_error = ?
                    WHERE id = ?;
                    """,
                    (new_retry, next_retry_at, error_msg[:500], record_id),
                )
                conn.commit()
                logger.warning(
                    "Event #%d failed (retry #%d). Retrying in %.2fs: %s",
                    record_id,
                    new_retry,
                    actual_delay,
                    error_msg,
                )
        except sqlite3.Error as e:
            logger.error("Failed to update failure for record #%d: %s", record_id, e)

        return actual_delay

    def get_stats(self) -> dict:
        """Returns counts by status."""
        try:
            with self._get_connection() as conn:
                cursor = conn.execute(
                    "SELECT status, COUNT(*) as cnt FROM outbox_events GROUP BY status;"
                )
                rows = cursor.fetchall()
                stats = {row["status"]: row["cnt"] for row in rows}
                return {
                    "PENDING": stats.get("PENDING", 0),
                    "SENT": stats.get("SENT", 0),
                    "TOTAL": sum(stats.values()),
                }
        except sqlite3.Error:
            return {"PENDING": 0, "SENT": 0, "TOTAL": 0}

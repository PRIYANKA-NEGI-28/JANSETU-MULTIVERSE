import logging
import threading
import time
from typing import Optional
from client import EdgeHttpClient
from outbox import SqliteOutbox

logger = logging.getLogger("jansetu_iot.sender")


class OutboxSender:
    """
    Background worker thread that continually flushes pending outbox events
    to the cloud backend with retry backoff and HMAC request signing.
    """

    def __init__(
        self,
        outbox: SqliteOutbox,
        client: EdgeHttpClient,
        event_url: str,
        flush_interval_sec: float = 0.5,
        max_backoff_delay: float = 60.0,
    ):
        self.outbox = outbox
        self.client = client
        self.event_url = event_url
        self.flush_interval_sec = flush_interval_sec
        self.max_backoff_delay = max_backoff_delay

        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._stop_event = threading.Event()

    def start(self) -> None:
        """Starts background worker thread."""
        self._running = True
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._worker_loop,
            name="OutboxSenderThread",
            daemon=True,
        )
        self._thread.start()
        logger.info("OutboxSender worker thread started")

    def stop(self, timeout: float = 2.0) -> None:
        """Signals worker thread to terminate and waits for join."""
        self._running = False
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=timeout)
        logger.info("OutboxSender worker thread stopped")

    def flush_once(self, current_time: Optional[float] = None) -> int:
        """
        Executes a single flush pass of pending records.
        Returns count of successfully delivered events.
        """
        pending_records = self.outbox.get_pending(limit=10, current_time=current_time)
        delivered_count = 0

        for record in pending_records:
            if not self._running and self._stop_event.is_set():
                break

            success, status_code, msg = self.client.send_signed_post(
                url=self.event_url,
                raw_json_body=record.payload_json,
            )

            if success:
                self.outbox.mark_sent(record.id)
                delivered_count += 1
                logger.info(
                    "Delivered event #%d [%s] to backend (HTTP %d)",
                    record.id,
                    record.idempotency_key,
                    status_code,
                )
            else:
                self.outbox.mark_failed(
                    record_id=record.id,
                    error_msg=msg,
                    current_retry_count=record.retry_count,
                    max_backoff_delay=self.max_backoff_delay,
                    current_time=current_time,
                )

        return delivered_count

    def _worker_loop(self) -> None:
        while self._running:
            try:
                self.flush_once()
            except Exception as e:
                logger.error("Unexpected error in OutboxSender loop: %s", e)

            self._stop_event.wait(self.flush_interval_sec)

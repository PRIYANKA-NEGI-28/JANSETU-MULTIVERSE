import os
import pytest
from outbox import SqliteOutbox


@pytest.fixture
def temp_outbox(tmp_path):
    db_file = tmp_path / "test_outbox.db"
    outbox = SqliteOutbox(str(db_file))
    return outbox


def test_outbox_enqueue_and_deduplication(temp_outbox):
    idempotency_key = "UNO_Q_01:1:FAULT"
    payload = {"device_id": "UNO_Q_01", "status": "FAULT"}

    # First insert succeeds
    assert temp_outbox.enqueue(idempotency_key, "UNO_Q_01", "FAULT_CONFIRMED", payload) is True

    # Duplicate insert is safely ignored
    assert temp_outbox.enqueue(idempotency_key, "UNO_Q_01", "FAULT_CONFIRMED", payload) is False

    stats = temp_outbox.get_stats()
    assert stats["PENDING"] == 1
    assert stats["TOTAL"] == 1


def test_outbox_get_pending_and_mark_sent(temp_outbox):
    temp_outbox.enqueue("key1", "DEV1", "FAULT", {"val": 1})
    temp_outbox.enqueue("key2", "DEV1", "RESOLVED", {"val": 2})

    pending = temp_outbox.get_pending(limit=5)
    assert len(pending) == 2
    assert pending[0].idempotency_key == "key1"
    assert pending[1].idempotency_key == "key2"

    temp_outbox.mark_sent(pending[0].id)
    stats = temp_outbox.get_stats()
    assert stats["PENDING"] == 1
    assert stats["SENT"] == 1

    remaining = temp_outbox.get_pending(limit=5)
    assert len(remaining) == 1
    assert remaining[0].idempotency_key == "key2"


def test_outbox_exponential_backoff_and_jitter(temp_outbox):
    temp_outbox.enqueue("key_fail", "DEV1", "FAULT", {"val": 1}, current_time=100.0)
    records = temp_outbox.get_pending(limit=1, current_time=100.0)
    assert len(records) == 1
    rec = records[0]

    # Retry 1: 2^1 * 1.0 = 2s (+/- 20% jitter: 1.6s to 2.4s)
    delay1 = temp_outbox.mark_failed(rec.id, "Connection refused", rec.retry_count, max_backoff_delay=60.0, current_time=100.0)
    assert 1.5 <= delay1 <= 2.5

    # Should not be returned while now < 100 + delay
    assert len(temp_outbox.get_pending(limit=1, current_time=101.0)) == 0

    # Should be returned once now >= 100 + delay
    available = temp_outbox.get_pending(limit=1, current_time=100.0 + delay1 + 0.1)
    assert len(available) == 1
    assert available[0].retry_count == 1
    assert available[0].last_error == "Connection refused"

    # Retry 2: 2^2 = 4s (+/- 20% jitter: 3.2s to 4.8s)
    delay2 = temp_outbox.mark_failed(available[0].id, "Timeout", available[0].retry_count, max_backoff_delay=60.0, current_time=105.0)
    assert 3.0 <= delay2 <= 5.0

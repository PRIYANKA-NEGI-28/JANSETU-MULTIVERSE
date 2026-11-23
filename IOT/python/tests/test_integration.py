import json
import pytest
from config import Config
from main import JanSetuEdgeDaemon
from models import McuTelemetry
from poller import McuPoller
from signer import verify_signature


class MockBridgeSequence:
    def __init__(self, sequence):
        self.sequence = sequence
        self.index = 0

    def call(self, method: str):
        if self.index < len(self.sequence):
            item = self.sequence[self.index]
            self.index += 1
            return item
        return self.sequence[-1] if self.sequence else "NORMAL"


class MockHttpClient:
    def __init__(self, should_succeed=True, fail_count=0):
        self.should_succeed = should_succeed
        self.fail_count = fail_count
        self.current_fails = 0
        self.sent_requests = []

    def send_signed_post(self, url: str, raw_json_body: str):
        self.sent_requests.append((url, raw_json_body))
        if self.current_fails < self.fail_count or not self.should_succeed:
            self.current_fails += 1
            return False, 503, "Service Unavailable (Offline)"
        return True, 201, "Created"

    def close(self):
        pass


def test_edge_daemon_offline_buffering_and_retry(tmp_path):
    db_file = tmp_path / "daemon_outbox.db"
    config = Config(
        backend_url="http://localhost:3000",
        device_uid="UNO_Q_TEST",
        device_hmac_secret="test-secret-key",
        outbox_db_path=str(db_file),
        poll_interval_sec=0.01,
        heartbeat_interval_sec=100.0,
    )

    # Sequence of MCU states:
    # 1. Boot: NORMAL
    # 2. Night lamp fault: FAULT_CONFIRMED
    # 3. Morning / Technician repair: NORMAL
    mcu_states = [
        {"state": "NORMAL", "ldr_raw": 750, "seq": 1, "uptime_ms": 1000},
        {"state": "FAULT_CONFIRMED", "ldr_raw": 150, "seq": 2, "uptime_ms": 6500, "fault_duration_ms": 1500},
        {"state": "NORMAL", "ldr_raw": 800, "seq": 3, "uptime_ms": 12000, "fault_duration_ms": 0},
    ]

    mock_bridge = MockBridgeSequence(mcu_states)
    poller = McuPoller(bridge_adapter=mock_bridge)
    daemon = JanSetuEdgeDaemon(config=config, poller=poller)

    # 1. Simulate offline network: HTTP fails with 503
    mock_http_failing = MockHttpClient(should_succeed=False)
    daemon.client = mock_http_failing
    daemon.sender.client = mock_http_failing

    # Step 1: Boot (NORMAL) -> No alert enqueued
    daemon.step(current_time=100.0)
    assert daemon.outbox.get_stats()["TOTAL"] == 0

    # Step 2: Anomaly confirmed (FAULT_CONFIRMED) -> Enqueued into outbox
    daemon.step(current_time=101.0)
    stats = daemon.outbox.get_stats()
    assert stats["TOTAL"] == 1
    assert stats["PENDING"] == 1

    # Attempt flush during network outage -> Event is preserved in outbox
    daemon.sender.flush_once(current_time=101.0)
    assert daemon.outbox.get_stats()["PENDING"] == 1
    assert daemon.outbox.get_stats()["SENT"] == 0

    # 2. Network recovers: HTTP client now returns 201
    mock_http_success = MockHttpClient(should_succeed=True)
    daemon.client = mock_http_success
    daemon.sender.client = mock_http_success

    # Flush again after retry delay window elapses (t=105s > 101s + delay) -> Delivered
    delivered = daemon.sender.flush_once(current_time=105.0)
    assert delivered == 1
    assert daemon.outbox.get_stats()["SENT"] == 1
    assert daemon.outbox.get_stats()["PENDING"] == 0

    # Verify payload format of the delivered request
    url, body = mock_http_success.sent_requests[0]
    assert url == "http://localhost:3000/api/sensor"
    parsed_body = json.loads(body)
    assert parsed_body["device_id"] == "UNO_Q_TEST"
    assert parsed_body["status"] == "FAULT"
    assert parsed_body["idempotency_key"] == "UNO_Q_TEST:2:FAULT"

    # Step 3: Repair / light restored -> Enqueued RESOLVED event
    daemon.step(current_time=106.0)
    assert daemon.outbox.get_stats()["TOTAL"] == 2
    assert daemon.outbox.get_stats()["PENDING"] == 1

    # Flush resolution event
    delivered_repair = daemon.sender.flush_once(current_time=106.0)
    assert delivered_repair == 1
    assert daemon.outbox.get_stats()["SENT"] == 2
    assert daemon.outbox.get_stats()["PENDING"] == 0


def test_edge_daemon_periodic_heartbeat(tmp_path):
    db_file = tmp_path / "heartbeat_outbox.db"
    config = Config(
        backend_url="http://localhost:3000",
        device_uid="UNO_Q_HB",
        device_hmac_secret="hb-secret",
        outbox_db_path=str(db_file),
        heartbeat_interval_sec=300.0,
    )

    mock_bridge = MockBridgeSequence([{"state": "NORMAL", "ldr_raw": 820, "seq": 1, "uptime_ms": 300000}])
    poller = McuPoller(bridge_adapter=mock_bridge)
    daemon = JanSetuEdgeDaemon(config=config, poller=poller)

    mock_http = MockHttpClient(should_succeed=True)
    daemon.client = mock_http

    # Step before 5 minutes (elapsed 100s) -> No heartbeat
    daemon.step(current_time=100.0)
    assert len(mock_http.sent_requests) == 0

    # Step after 5 minutes (elapsed 305s from boot) -> Heartbeat transmitted
    daemon.step(current_time=305.0)
    assert len(mock_http.sent_requests) == 1

    url, body = mock_http.sent_requests[0]
    assert url == "http://localhost:3000/api/sensor"
    data = json.loads(body)
    assert data["device_id"] == "UNO_Q_HB"
    assert data["state"] == "NORMAL"
    assert data["status"] == "HEALTHY"
    assert data["ldr_raw"] == 820
    assert data["uptime_ms"] == 300000


def test_edge_http_client_live_signing():
    import httpx
    from client import EdgeHttpClient

    secret = "production-hmac-secret-999"
    device_id = "UNO_Q_TEST_01"

    captured_requests = []

    def mock_transport_handler(request: httpx.Request):
        captured_requests.append(request)
        return httpx.Response(201, json={"status": "OK"})

    client = EdgeHttpClient(
        device_uid=device_id,
        device_hmac_secret=secret,
        timeout=5.0,
        verify_ssl=True,
    )
    # Inject mock transport into client
    client._client = httpx.Client(
        transport=httpx.MockTransport(mock_transport_handler),
        timeout=5.0,
    )

    payload_str = json.dumps({"status": "FAULT", "device_id": device_id})
    success, status_code, body = client.send_signed_post("https://example.com/api/sensor", payload_str)

    assert success is True
    assert status_code == 201
    assert len(captured_requests) == 1

    req = captured_requests[0]
    assert req.headers["Content-Type"] == "application/json"
    assert req.headers["X-Device-ID"] == device_id
    assert "X-Timestamp" in req.headers
    assert "X-Signature" in req.headers

    # Verify signature against request body
    is_valid = verify_signature(
        secret=secret,
        device_id=device_id,
        timestamp=req.headers["X-Timestamp"],
        raw_json_body=req.content.decode("utf-8"),
        signature=req.headers["X-Signature"],
    )
    assert is_valid is True

import pytest
from poller import McuPoller
from models import McuTelemetry


class MockBridge:
    def __init__(self, telemetry_data=None, status_data=None, raise_on_telemetry=False):
        self.telemetry_data = telemetry_data
        self.status_data = status_data
        self.raise_on_telemetry = raise_on_telemetry

    def call(self, method: str):
        if method == "get_telemetry":
            if self.raise_on_telemetry:
                raise RuntimeError("Method get_telemetry not implemented")
            return self.telemetry_data
        elif method == "get_status":
            return self.status_data
        raise ValueError(f"Unknown mock method: {method}")


def test_poller_structured_dict():
    mock = MockBridge(
        telemetry_data={
            "state": "FAULT_CONFIRMED",
            "ldr_raw": 180,
            "seq": 4,
            "uptime_ms": 45000,
            "fault_duration_ms": 5000,
        }
    )
    poller = McuPoller(bridge_adapter=mock)
    res = poller.poll()

    assert isinstance(res, McuTelemetry)
    assert res.state == "FAULT_CONFIRMED"
    assert res.ldr_raw == 180
    assert res.seq == 4
    assert res.uptime_ms == 45000
    assert res.fault_duration_ms == 5000


def test_poller_structured_json_string():
    mock = MockBridge(
        telemetry_data='{"state":"POSSIBLE_FAULT","ldr_raw":290,"seq":2,"uptime_ms":12000,"fault_duration_ms":0}'
    )
    poller = McuPoller(bridge_adapter=mock)
    res = poller.poll()

    assert res.state == "POSSIBLE_FAULT"
    assert res.ldr_raw == 290
    assert res.seq == 2


def test_poller_legacy_status_string_fallback():
    mock = MockBridge(
        telemetry_data=None,
        status_data="NORMAL",
        raise_on_telemetry=True,
    )
    poller = McuPoller(bridge_adapter=mock)
    res = poller.poll()

    assert res.state == "NORMAL"
    assert res.ldr_raw == 0
    assert res.seq == 0

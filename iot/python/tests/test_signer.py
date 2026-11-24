import json
import pytest
from signer import sign_request, verify_signature, compute_hmac_sha256


def test_hmac_sha256_computation():
    secret = "test-secret-key-123"
    message = "1732380000.{\"status\":\"FAULT\"}"
    sig = compute_hmac_sha256(secret, message)
    assert len(sig) == 64
    assert sig.isalnum()


def test_sign_request_headers():
    secret = "jansetu-iot-dev-secret"
    device_id = "UNO_Q_01"
    raw_body = json.dumps({"status": "FAULT", "device_id": "UNO_Q_01"})
    ts = 1732380000

    headers = sign_request(secret, device_id, raw_body, timestamp=ts)

    assert headers["Content-Type"] == "application/json"
    assert headers["X-Device-ID"] == "UNO_Q_01"
    assert headers["X-Timestamp"] == "1732380000"
    assert "X-Signature" in headers
    assert len(headers["X-Signature"]) == 64


def test_verify_signature_success():
    secret = "secret-key"
    device_id = "DEV_01"
    raw_body = "{\"key\":\"value\"}"
    ts = "1732380000"

    headers = sign_request(secret, device_id, raw_body, timestamp=int(ts))
    is_valid = verify_signature(
        secret=secret,
        device_id=device_id,
        timestamp=headers["X-Timestamp"],
        raw_json_body=raw_body,
        signature=headers["X-Signature"],
    )
    assert is_valid is True


def test_verify_signature_tamper_detection():
    secret = "secret-key"
    device_id = "DEV_01"
    raw_body = "{\"status\":\"NORMAL\"}"
    ts = "1732380000"

    headers = sign_request(secret, device_id, raw_body, timestamp=int(ts))

    # 1. Tamper with body
    tampered_body = "{\"status\":\"FAULT\"}"
    assert not verify_signature(
        secret, device_id, headers["X-Timestamp"], tampered_body, headers["X-Signature"]
    )

    # 2. Tamper with timestamp
    assert not verify_signature(
        secret, device_id, "1732380001", raw_body, headers["X-Signature"]
    )

    # 3. Tamper with secret
    assert not verify_signature(
        "wrong-secret", device_id, headers["X-Timestamp"], raw_body, headers["X-Signature"]
    )

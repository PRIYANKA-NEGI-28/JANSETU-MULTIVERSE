import hashlib
import hmac
import time
from typing import Optional, Dict


def compute_hmac_sha256(secret: str, message: str) -> str:
    """Computes hexadecimal HMAC-SHA256 signature for a message given a secret."""
    secret_bytes = secret.encode("utf-8")
    message_bytes = message.encode("utf-8")
    return hmac.new(secret_bytes, message_bytes, hashlib.sha256).hexdigest()


def sign_request(
    secret: str,
    device_id: str,
    raw_json_body: str,
    timestamp: Optional[int] = None,
) -> Dict[str, str]:
    """
    Signs request body using HMAC-SHA256 over:
    `timestamp + "." + raw_json_body`

    Returns dictionary of security headers:
    - X-Device-ID
    - X-Timestamp
    - X-Signature
    - Content-Type
    """
    ts = timestamp if timestamp is not None else int(time.time())
    message = f"{ts}.{raw_json_body}"
    signature = compute_hmac_sha256(secret, message)

    return {
        "Content-Type": "application/json",
        "X-Device-ID": device_id,
        "X-Timestamp": str(ts),
        "X-Signature": signature,
    }


def verify_signature(
    secret: str,
    device_id: str,
    timestamp: str,
    raw_json_body: str,
    signature: str,
) -> bool:
    """
    Verifies that a received signature matches the expected HMAC-SHA256
    using constant-time comparison to prevent timing attacks.
    """
    message = f"{timestamp}.{raw_json_body}"
    expected = compute_hmac_sha256(secret, message)
    return hmac.compare_digest(expected, signature)

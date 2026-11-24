import logging
from typing import Tuple
import httpx
from signer import sign_request

logger = logging.getLogger("jansetu_iot.client")


class EdgeHttpClient:
    """
    HTTP client using httpx with strict TLS verification and HMAC-SHA256 request signing.
    """

    def __init__(
        self,
        device_uid: str,
        device_hmac_secret: str,
        timeout: float = 10.0,
        verify_ssl: bool = True,
    ):
        self.device_uid = device_uid
        self.device_hmac_secret = device_hmac_secret
        self.timeout = timeout
        self.verify_ssl = verify_ssl
        self._client = httpx.Client(
            timeout=self.timeout,
            verify=self.verify_ssl,
        )

    def send_signed_post(self, url: str, raw_json_body: str) -> Tuple[bool, int, str]:
        """
        Sends signed JSON POST request.
        Returns (success: bool, status_code: int, error_or_body: str)
        """
        headers = sign_request(
            secret=self.device_hmac_secret,
            device_id=self.device_uid,
            raw_json_body=raw_json_body,
        )

        try:
            response = self._client.post(
                url=url,
                content=raw_json_body.encode("utf-8"),
                headers=headers,
            )

            if response.status_code in (200, 201, 202):
                logger.debug("POST %s succeeded [%d]", url, response.status_code)
                return True, response.status_code, response.text
            else:
                msg = f"HTTP {response.status_code}: {response.text[:200]}"
                logger.warning("POST %s returned non-2xx [%s]", url, msg)
                return False, response.status_code, msg

        except httpx.RequestError as e:
            err_msg = f"Network transport error: {type(e).__name__} - {e}"
            logger.warning("Failed POST to %s: %s", url, err_msg)
            return False, 0, err_msg

    def close(self) -> None:
        self._client.close()

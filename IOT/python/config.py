import os


class Config:
    def __init__(self):
        # ----------------------------------------------------------
        # Backend Configuration
        # ----------------------------------------------------------
        self.backend_url = (
            os.getenv("BACKEND_URL")
            or os.getenv("API_URL")
            or os.getenv("HTTP_ENDPOINT")
            or "https://jansetu-multiverse.onrender.com"
        )

        # Final backend endpoint
        self.endpoint_url = (
            self.backend_url.rstrip("/") + "/api/sensor"
        )

        # ----------------------------------------------------------
        # HTTP Configuration
        # ----------------------------------------------------------
        self.request_timeout = float(
            os.getenv("REQUEST_TIMEOUT", "10.0")
        )

        self.max_backoff_delay = float(
            os.getenv("MAX_BACKOFF_DELAY", "60.0")
        )
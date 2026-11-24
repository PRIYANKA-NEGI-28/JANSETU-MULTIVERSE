import json
import logging
from typing import Any, Optional
from models import McuTelemetry

logger = logging.getLogger("jansetu_iot.poller")


class McuPoller:
    """
    Polls the real-time Arduino UNO Q microcontroller via RouterBridge RPC.
    Gracefully handles both structured telemetry and legacy plain status strings.
    """

    def __init__(self, bridge_adapter: Optional[Any] = None):
        if bridge_adapter is not None:
            self.bridge = bridge_adapter
        else:
            try:
                from arduino.app_utils import Bridge
                self.bridge = Bridge
            except ImportError:
                self.bridge = None
                logger.warning("arduino.app_utils.Bridge not available. Running in mock/headless mode.")

    def poll(self) -> Optional[McuTelemetry]:
        """
        Queries MCU across RouterBridge.
        Attempts 'get_telemetry' structured call first; falls back to 'get_status'.
        """
        if self.bridge is None:
            return None

        # 1. Attempt structured telemetry RPC getter
        try:
            res = self.bridge.call("get_telemetry")
            if res:
                return self._parse_telemetry(res)
        except Exception as e:
            logger.debug("Bridge.call('get_telemetry') failed: %s; trying 'get_status'", e)

        # 2. Fallback to legacy string getter
        try:
            res = self.bridge.call("get_status")
            if res:
                return self._parse_telemetry(res)
        except Exception as e:
            logger.warning("Bridge.call('get_status') failed: %s", e)
            return None

        return None

    def _parse_telemetry(self, raw_data: Any) -> McuTelemetry:
        """Parses dict, JSON string, or bare state string into McuTelemetry."""
        if isinstance(raw_data, dict):
            return McuTelemetry(
                state=raw_data.get("state", "UNKNOWN"),
                ldr_raw=int(raw_data.get("ldr_raw", 0)),
                seq=int(raw_data.get("seq", 0)),
                uptime_ms=int(raw_data.get("uptime_ms", 0)),
                fault_duration_ms=int(raw_data.get("fault_duration_ms", 0)),
            )

        if isinstance(raw_data, str):
            trimmed = raw_data.strip()
            if trimmed.startswith("{") and trimmed.endswith("}"):
                try:
                    parsed = json.loads(trimmed)
                    return McuTelemetry(
                        state=parsed.get("state", "UNKNOWN"),
                        ldr_raw=int(parsed.get("ldr_raw", 0)),
                        seq=int(parsed.get("seq", 0)),
                        uptime_ms=int(parsed.get("uptime_ms", 0)),
                        fault_duration_ms=int(parsed.get("fault_duration_ms", 0)),
                    )
                except Exception:
                    pass

            # Plain status string fallback (e.g. "NORMAL", "FAULT_CONFIRMED")
            return McuTelemetry(
                state=trimmed,
                ldr_raw=0,
                seq=0,
                uptime_ms=0,
                fault_duration_ms=0,
            )

        raise ValueError(f"Unsupported telemetry format: {type(raw_data)}")

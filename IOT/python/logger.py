import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path


def setup_logger(
    log_level: str = "INFO",
    log_file_path: str = "jansetu_iot.log",
    max_bytes: int = 1_048_576,  # 1 MB
    backup_count: int = 3,
) -> logging.Logger:
    """
    Configures structured logging with stdout stream and rotating file handler
    to prevent SD card / eMMC flash storage exhaustion on embedded Linux.
    """
    root_logger = logging.getLogger("jansetu_iot")
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    root_logger.setLevel(numeric_level)

    # Clear existing handlers to prevent duplicates
    if root_logger.hasHandlers():
        root_logger.handlers.clear()

    formatter = logging.Formatter(
        fmt="[%(asctime)s] [%(levelname)-7s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # 1. Console Stream Handler (stdout)
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    stream_handler.setLevel(numeric_level)
    root_logger.addHandler(stream_handler)

    # 2. Rotating File Handler (Flash Protection)
    try:
        log_dir = Path(log_file_path).parent
        if str(log_dir) not in ("", "."):
            log_dir.mkdir(parents=True, exist_ok=True)

        file_handler = RotatingFileHandler(
            filename=log_file_path,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding="utf-8",
        )
        file_handler.setFormatter(formatter)
        file_handler.setLevel(numeric_level)
        root_logger.addHandler(file_handler)
    except Exception as e:
        sys.stderr.write(f"[WARN] Failed to configure rotating file log: {e}\n")

    return root_logger

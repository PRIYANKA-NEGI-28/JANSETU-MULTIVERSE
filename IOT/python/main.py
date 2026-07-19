#!/usr/bin/env python3

import time
import traceback

from arduino.app_utils import Bridge, App

from config import Config
from logger import setup_logger
from sender import EventSender

setup_logger()

config = Config()

sender = EventSender(
    endpoint_url=config.endpoint_url,
    request_timeout=config.request_timeout,
    max_backoff_delay=config.max_backoff_delay,
)

sender.start()

last_state = None


def poll_mcu():

    global last_state

    try:
        state = Bridge.call("get_status")

        if state != last_state:

            print(f"State changed: {last_state} -> {state}")

            if state == "FAULT_CONFIRMED":
                sender.queue_event("FAULT")

            elif (
                last_state == "FAULT_CONFIRMED"
                and state == "NORMAL"
            ):
                sender.queue_event("RESOLVED")

            last_state = state

    except Exception:
        traceback.print_exc()

    time.sleep(1)


App.run(user_loop=poll_mcu)
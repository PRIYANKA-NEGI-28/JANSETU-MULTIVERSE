import queue
import logging
import threading
import time
import requests

class EventSender:
    def __init__(self, endpoint_url, request_timeout=10.0, max_backoff_delay=60.0):
        self.endpoint_url = endpoint_url
        self.request_timeout = request_timeout
        self.max_backoff_delay = max_backoff_delay
        self.queue = queue.Queue()
        self.worker_thread = None
        self.running = False

    def start(self):
        """
        Starts the background worker thread.
        """
        self.running = True
        self.worker_thread = threading.Thread(
            target=self._worker_loop,
            name="SenderThread",
            daemon=True
        )
        self.worker_thread.start()

    def stop(self):
        """
        Signals the worker thread to stop and waits for it to join.
        """
        self.running = False
        self.queue.put(None)  # Poison pill
        if self.worker_thread:
            self.worker_thread.join(timeout=2.0)

    def queue_event(self, status):
        """
        Constructs the fixed JSON payload and queues it.
        """
        payload = {
            "device_id": "UNO_Q_01",
            "status": status,
            "type": "STREETLIGHT"
        }
        logging.info(f"Queuing event '{status}'")
        self.queue.put(payload)

    def _worker_loop(self):
        logging.info("Sender worker thread started.")
        while self.running:
            payload = self.queue.get()
            if payload is None:
                self.queue.task_done()
                break

            delay = 1.0
            success = False
            
            while not success and self.running:
                try:
                    logging.info(f"Sending POST payload to {self.endpoint_url}: {payload}")
                    response = requests.post(
                        self.endpoint_url,
                        json=payload,
                        timeout=self.request_timeout
                    )
                    
                    if response.status_code in [200, 201]:
                        logging.info(f"Payload successfully delivered. Response: {response.status_code}")
                        success = True
                    else:
                        logging.error(f"Backend returned non-success code {response.status_code}. Retrying...")
                        time.sleep(delay)
                        delay = min(delay * 2.0, self.max_backoff_delay)
                except requests.RequestException as e:
                    logging.warning(f"Network error sending payload: {e}. Retrying in {delay}s...")
                    time.sleep(delay)
                    delay = min(delay * 2.0, self.max_backoff_delay)
                    
            self.queue.task_done()
location = '/api/sensor-alert'  # Backend endpoint path matching requirements

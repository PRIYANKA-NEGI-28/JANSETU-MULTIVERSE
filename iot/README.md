# JanSetu IoT Edge Device

An intelligent edge-based streetlight monitoring system built on the Arduino UNO Q platform that automatically detects streetlight failures, verifies faults using a finite state machine, and reports confirmed incidents to the JanSetu cloud platform.

---

# About

The JanSetu IoT Edge Device continuously monitors the operational status of a streetlight using an LDR sensor. Instead of reporting every temporary fluctuation, the firmware verifies faults using a Finite State Machine (FSM), reducing false alarms caused by passing vehicles, shadows, or temporary lighting changes.

Once a fault is confirmed, the Arduino UNO Q communicates with its onboard Linux MPU using RouterBridge RPC. The Linux MPU packages the event into a JSON payload and securely uploads it to the JanSetu cloud backend hosted on Render.

The same process automatically reports when the streetlight has been repaired.

---

# Features

* Automatic streetlight failure detection using an LDR sensor.
* Multi-stage Finite State Machine (FSM) for false-positive filtering.
* RouterBridge RPC communication between MCU and Linux MPU.
* Automatic fault confirmation after configurable delay.
* Automatic repair detection.
* Secure HTTPS communication with the cloud backend.
* Automatic complaint registration.
* Automatic complaint resolution.
* Retry mechanism with exponential backoff for network failures.
* Modular firmware architecture.
* Production-ready event-driven design.

---

# System Architecture

```text
Streetlight
     │
     ▼
LDR Sensor
     │
     ▼
Arduino UNO Q MCU
(Finite State Machine)
     │
     ▼
RouterBridge RPC
     │
     ▼
Linux MPU (Python)
     │
     ▼
HTTPS POST
     │
     ▼
JanSetu Cloud Backend (Render)
     │
     ▼
Complaint Registration
```

---

# Hardware Components

* Arduino UNO Q
* LDR Module
* White LED (Streetlight Simulator)
* Green LED (Normal Status)
* Red LED (Fault Status)
* Push Button (Repair Simulation)
* Breadboard
* Jumper Wires
* Resistors

---

# Software Stack

## Firmware (MCU)

* Arduino C++
* Finite State Machine
* RouterBridge

## Linux MPU

* Python 3
* RouterBridge Python API
* Requests
* Logging

## Cloud

* Node.js
* Express
* Render
* REST API

---

# Detection Workflow

## Normal Operation

The LDR continuously monitors the simulated streetlight.

```
NORMAL
```

↓

Streetlight turns OFF

↓

```
POSSIBLE_FAULT
```

↓

Darkness persists beyond threshold

↓

```
FAULT_CONFIRMED
```

↓

Cloud complaint created

---

## Repair Workflow

Streetlight turns ON again

↓

```
NORMAL
```

↓

Cloud complaint resolved automatically

---

# Communication

The MCU exposes its state using RouterBridge.

Python periodically polls:

```python
Bridge.call("get_status")
```

Possible responses:

```
NORMAL
POSSIBLE_FAULT
FAULT_CONFIRMED
```

Python detects state transitions and uploads only confirmed events.

---

# JSON Payload

## Fault Event

```json
{
    "device_id": "UNO_Q_01",
    "status": "FAULT",
    "type": "STREETLIGHT"
}
```

---

## Resolution Event

```json
{
    "device_id": "UNO_Q_01",
    "status": "RESOLVED",
    "type": "STREETLIGHT"
}
```

---

# Backend Endpoint

```
POST /api/sensor
```

Example deployment:

```
https://jansetu-multiverse.onrender.com/api/sensor
```

---

# Project Structure

```
iot/
├── sketch/                   # Hardened Arduino UNO Q C++ Firmware
│   ├── pins.h                # Pinout, thresholds, and timing parameters
│   ├── sensors.h / .cpp      # 16-sample rolling average ADC sampling with hysteresis
│   ├── button.h / .cpp       # 50ms hardware debounce with single-trigger edge detection
│   ├── outputs.h / .cpp      # White, Green, and Red indicator LED management
│   ├── fsm.h / .cpp          # 3-state FSM (NORMAL -> POSSIBLE_FAULT -> FAULT_CONFIRMED)
│   ├── communication.h / .cpp# RouterBridge RPC bindings & USB Serial terminal
│   ├── sketch.ino            # Main firmware entrypoint with 4s Watchdog Timer
│   ├── test_firmware.cpp     # Host C++ unit test runner
│   └── README.md             # Detailed hardware & wiring specification
│
├── python/                   # Hardened Linux MPU Agent
│   ├── models.py             # Pydantic data contracts (events, heartbeats, telemetry)
│   ├── config.py             # Environment configuration (Pydantic + dotenv)
│   ├── signer.py             # HMAC-SHA256 request signing and verification
│   ├── outbox.py             # SQLite WAL store-and-forward persistence engine
│   ├── client.py             # httpx client with strict TLS and HMAC headers
│   ├── poller.py             # RouterBridge RPC poller with fallback
│   ├── sender.py             # Resilient background worker with exponential backoff + jitter
│   ├── logger.py             # Rotating file logs protecting eMMC/SD storage
│   ├── main.py               # Main daemon with clean signal shutdown (SIGINT/SIGTERM)
│   ├── pytest.ini            # Pytest test harness configuration
│   ├── requirements.txt      # Pinned dependencies (httpx, pydantic, python-dotenv, pytest)
│   ├── .env.example          # Environment variable template
│   └── tests/                # Unit test suite
│       ├── test_signer.py
│       ├── test_outbox.py
│       ├── test_poller.py
│       └── test_integration.py
│
├── app.yaml                  # Arduino App descriptor
└── README.md                 # System overview and quickstart guide
```

---

## Installation & Setup

### Prerequisites

* Arduino UNO Q (or Debian Linux gateway + Arduino microcontroller)
* Python 3.10+
* `uv` (fast Python toolchain)

---

## Configure Environment

Copy `.env.example` to `.env` in `iot/python/`:

```bash
cp iot/python/.env.example iot/python/.env
```

Key environment variables (NO hardcoded URLs in source code):
- `BACKEND_URL`: URL of the JanSetu backend API (e.g. `http://localhost:3000` or production domain)
- `DEVICE_UID`: Hardware node identifier (`UNO_Q_01`)
- `DEVICE_HMAC_SECRET`: Cryptographic shared secret for HMAC-SHA256 request signing
- `POLL_INTERVAL_SEC`: Frequency of MCU telemetry polling (`1.0`)
- `HEARTBEAT_INTERVAL_SEC`: Frequency of health heartbeats (`300.0` = 5 minutes)
- `OUTBOX_DB_PATH`: Path to SQLite store-and-forward outbox (`outbox.db`)

---

## Run Unit Tests

Execute the automated test suite across all Python MPU modules:

```bash
cd iot/python
uv venv .venv
uv pip install -r requirements.txt
uv run pytest -v
```

---

## Run the Edge Daemon

Start the Linux MPU application:

```bash
cd iot/python
uv run python main.py
```

---

# Event Flow

```
Streetlight OFF

↓

FSM confirms failure

↓

RouterBridge RPC

↓

Python

↓

Generate JSON

↓

HTTPS POST

↓

Render Backend

↓

Complaint Registered
```

---

# Future Improvements

* GPS integration for automatic pole location.
* Device ID provisioning for large-scale deployments.
* OTA firmware updates.
* Offline event buffering.
* Battery and health monitoring.
* MQTT support.
* LoRaWAN / NB-IoT connectivity.
* Multiple sensor support.
* Predictive maintenance using AI.

---

# Contributors

* Divyansh Gupta
* Priyanka Negi
* Ritu Raj Sinha
* Rishav Raj

---

# License

This project is released under the MIT License.
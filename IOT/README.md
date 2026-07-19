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
jansetu/
│
├── sketch/
│   ├── communication.cpp
│   ├── communication.h
│   ├── fsm.cpp
│   ├── fsm.h
│   ├── sensors.cpp
│   ├── sensors.h
│   ├── outputs.cpp
│   ├── outputs.h
│   └── sketch.ino
│
├── python/
│   ├── main.py
│   ├── sender.py
│   ├── config.py
│   ├── logger.py
│   └── requirements.txt
│
└── app.yaml
```

---

# Installation

## Prerequisites

* Arduino UNO Q
* Arduino App
* Python 3
* Internet Connection

---

## Clone Repository

```bash
git clone https://github.com/<repository>/jansetu-iot.git

cd jansetu-iot
```

---

## Configure Backend

Edit `config.py`

```python
self.backend_url = "https://jansetu-multiverse.onrender.com"
```

---

## Run

Flash the Arduino firmware.

Start the Linux MPU application from Arduino App.

The device automatically begins monitoring the streetlight.

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
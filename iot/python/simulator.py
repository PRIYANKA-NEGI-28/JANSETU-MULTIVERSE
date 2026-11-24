#!/usr/bin/env python3
"""
JanSetu IoT Edge Hardware-less CLI Simulator
Simulates Arduino UNO Q MCU transitions and Linux MPU gateway dispatch.

Scenarios supported:
- normal: Emits steady-state illumination and periodic signed heartbeat.
- headlight_glitch: Simulates transient car headlight/cloud dip and recovery.
- fault: Simulates persistent streetlight blackout, confirming fault and creating cluster.
- offline_queue_replay: Simulates network outage, local SQLite buffering, and replay.
- repair: Simulates field technician push button repair and automatic ticket resolution.
- full_demo: Sequentially executes all stages in an interactive demonstration.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from client import EdgeHttpClient
from config import Config
from outbox import SqliteOutbox
from signer import sign_request


def print_banner(title: str):
    print("\n" + "=" * 65)
    print(f" >>> {title.upper()}")
    print("=" * 65)


def run_normal(client: EdgeHttpClient, config: Config):
    print_banner("Scenario 1: Steady-State Normal Operation & Heartbeat")
    print(f"[*] Device UID:    {config.device_uid}")
    print(f"[*] Target URL:    {config.backend_url}/api/v1/iot/heartbeat")
    print("[*] MCU State:     NORMAL (Streetlight luminaire ON, LDR ADC = 820)")

    heartbeat_payload = {
        "device_id": config.device_uid,
        "status": "HEALTHY",
        "state": "NORMAL",
        "uptime_ms": 125000,
        "ldr_raw": 820,
        "seq": 1,
        "timestamp": int(time.time()),
    }

    body = json.dumps(heartbeat_payload, separators=(",", ":"), sort_keys=True)
    print(f"[>] Transmitting signed heartbeat: {body}")

    success, code, msg = client.send_signed_post(f"{config.backend_url}/api/v1/iot/heartbeat", body)
    if success:
        print(f"[✔] Heartbeat accepted by JanSetu backend (HTTP {code})")
    else:
        print(f"[✘] Backend request failed (HTTP {code}): {msg}")


def run_headlight_glitch(delay: float):
    print_banner("Scenario 2: Transient Headlight / Cloud Glitch (Anti-Flicker)")
    print("[*] Demonstrating 16-sample rolling average filter and 5.0s FSM countdown.")

    samples = [
        ("t=0.0s", 810, "NORMAL", "Steady baseline illumination"),
        ("t=0.5s", 210, "POSSIBLE_FAULT", "Transient darkness (car shadow / leaf)"),
        ("t=1.5s", 190, "POSSIBLE_FAULT", "Countdown in progress: 3.5s remaining... Red LED blinking"),
        ("t=2.5s", 830, "NORMAL", "Illumination recovered (750 > THRESHOLD_LIGHT 550)"),
    ]

    for timestamp, ldr, state, note in samples:
        print(f"  [{timestamp}] LDR ADC: {ldr:3d} | FSM State: {state:14s} | {note}")
        time.sleep(delay)

    print("[✔] Transient dip safely filtered! Zero false complaints created.")


def run_fault(client: EdgeHttpClient, config: Config, outbox: SqliteOutbox, delay: float):
    print_banner("Scenario 3: Persistent Streetlight Failure (Cluster Auto-Creation)")
    print("[*] Simulating continuous darkness lasting >= 5.0 seconds.")

    countdown = [
        ("t=0.0s", 180, "POSSIBLE_FAULT", "Failure candidate detected. Starting 5s validation timer..."),
        ("t=2.0s", 160, "POSSIBLE_FAULT", "Darkness persists (3.0s remaining)"),
        ("t=4.0s", 150, "POSSIBLE_FAULT", "Darkness persists (1.0s remaining)"),
        ("t=5.0s", 145, "FAULT_CONFIRMED", "Persistent failure confirmed! Monotonic seq=2."),
    ]

    for timestamp, ldr, state, note in countdown:
        print(f"  [{timestamp}] LDR: {ldr:3d} | FSM: {state:15s} | {note}")
        time.sleep(delay * 0.5)

    idempotency_key = f"{config.device_uid}:2:FAULT"
    event_payload = {
        "device_id": config.device_uid,
        "status": "FAULT",
        "type": "STREETLIGHT",
        "idempotency_key": idempotency_key,
        "seq": 2,
        "uptime_ms": 130000,
        "ldr_raw": 145,
        "fault_duration_ms": 100,
        "timestamp": int(time.time()),
    }

    outbox.enqueue(idempotency_key, config.device_uid, "FAULT_CONFIRMED", event_payload)
    print(f"[+] Persisted in local SQLite outbox: {idempotency_key}")

    body = json.dumps(event_payload, separators=(",", ":"), sort_keys=True)
    success, code, res = client.send_signed_post(f"{config.backend_url}/api/v1/iot/events", body)

    if success:
        outbox.mark_sent(1)
        data = json.loads(res)
        print(f"[✔] Fault event ingested by backend (HTTP {code})")
        print(f"    - Cluster ID:      {data.get('clusterId')}")
        print(f"    - Tracking Code:   {data.get('trackingCode')}")
        print(f"    - Real-time Alert: Dispatched to Ably channel 'admin:alerts'")
    else:
        print(f"[✘] Ingestion failed (HTTP {code}): {res}")


def run_offline_queue_replay(client: EdgeHttpClient, config: Config, outbox: SqliteOutbox):
    print_banner("Scenario 4: Offline Store-and-Forward Outbox & Replay")
    print("[*] Simulating edge cellular/Wi-Fi dropout. Events buffered in SQLite.")

    # Enqueue 2 events while offline
    k1 = f"{config.device_uid}:3:FAULT_INTERMITTENT"
    k2 = f"{config.device_uid}:4:FAULT_CONFIRMED"
    outbox.enqueue(k1, config.device_uid, "FAULT_CONFIRMED", {"device_id": config.device_uid, "status": "FAULT", "idempotency_key": k1})
    outbox.enqueue(k2, config.device_uid, "FAULT_CONFIRMED", {"device_id": config.device_uid, "status": "FAULT", "idempotency_key": k2})

    stats = outbox.get_stats()
    print(f"[+] Local Outbox Buffer: {stats['PENDING']} pending items waiting in WAL SQLite store.")

    print("[*] Edge network reconnected! Replaying buffered queue...")
    pending = outbox.get_pending(limit=5)
    delivered = 0
    for rec in pending:
        success, code, _ = client.send_signed_post(f"{config.backend_url}/api/v1/iot/events", rec.payload_json)
        if success:
            outbox.mark_sent(rec.id)
            delivered += 1
            print(f"  [✔] Replayed event #{rec.id} [{rec.idempotency_key}] -> HTTP {code}")

    remaining = outbox.get_stats()["PENDING"]
    if remaining == 0 and delivered > 0:
        print("[✔] All buffered outbox events safely delivered without data loss!")
    elif delivered > 0:
        print(f"[✔] Replayed {delivered} events. {remaining} events pending in outbox.")
    else:
        print(f"[*] Offline events safely retained in SQLite outbox ({remaining} pending, zero data loss).")


def run_repair(client: EdgeHttpClient, config: Config, outbox: SqliteOutbox):
    print_banner("Scenario 5: Tactile Repair Push Button / Light Restoration")
    print("[*] Field technician replaces luminaire and presses tactile repair push button.")
    print("[*] Hardware debounce (50ms) triggers single falling-edge transition back to NORMAL.")

    idempotency_key = f"{config.device_uid}:5:RESOLVED"
    event_payload = {
        "device_id": config.device_uid,
        "status": "RESOLVED",
        "type": "STREETLIGHT",
        "idempotency_key": idempotency_key,
        "seq": 5,
        "uptime_ms": 180000,
        "ldr_raw": 840,
        "fault_duration_ms": 0,
        "timestamp": int(time.time()),
    }

    outbox.enqueue(idempotency_key, config.device_uid, "FAULT_CLEARED", event_payload)
    body = json.dumps(event_payload, separators=(",", ":"), sort_keys=True)
    success, code, res = client.send_signed_post(f"{config.backend_url}/api/v1/iot/events", body)

    if success:
        data = json.loads(res)
        print(f"[✔] Resolution ingested by backend (HTTP {code})")
        print(f"    - Active Cluster Resolved: {data.get('activeClusterIdResolved')}")
        print("    - Audit Event Logged:      IOT_CLEARED")
        print("    - Real-time Alert:         Dispatched to Ably channel 'admin:alerts'")
    else:
        print(f"[✘] Repair ingestion failed (HTTP {code}): {res}")


def main():
    parser = argparse.ArgumentParser(description="JanSetu IoT Edge Node Hardware-less CLI Simulator")
    parser.add_argument(
        "--scenario",
        choices=["normal", "headlight_glitch", "fault", "offline_queue_replay", "repair", "full_demo"],
        default="full_demo",
        help="Which operational scenario to execute",
    )
    parser.add_argument("--backend-url", default=None, help="Backend URL (defaults to BACKEND_URL env or http://localhost:3000)")
    parser.add_argument("--device-uid", default=None, help="Device UID (defaults to UNO_Q_01)")
    parser.add_argument("--secret", default=None, help="HMAC shared secret")
    parser.add_argument("--delay", type=float, default=0.6, help="Delay between demonstration steps (seconds)")

    args = parser.parse_args()

    config = Config()
    if args.backend_url:
        config.backend_url = args.backend_url.rstrip("/")
    if args.device_uid:
        config.device_uid = args.device_uid
    if args.secret:
        config.device_hmac_secret = args.secret

    sim_db_path = "simulator_outbox.db"
    outbox = SqliteOutbox(db_path=sim_db_path)
    client = EdgeHttpClient(
        device_uid=config.device_uid,
        device_hmac_secret=config.device_hmac_secret,
        timeout=config.request_timeout,
        verify_ssl=False if "localhost" in config.backend_url else True,
    )

    print("\n" + "=" * 65)
    print(" JANSETU IOT EDGE NODE — HARDWARE-LESS CLI SIMULATOR ")
    print("=" * 65)
    print(f" Device UID:    {config.device_uid}")
    print(f" Backend URL:   {config.backend_url}")
    print(f" Scenario:      {args.scenario}")
    print("=" * 65)

    try:
        if args.scenario == "normal":
            run_normal(client, config)
        elif args.scenario == "headlight_glitch":
            run_headlight_glitch(args.delay)
        elif args.scenario == "fault":
            run_fault(client, config, outbox, args.delay)
        elif args.scenario == "offline_queue_replay":
            run_offline_queue_replay(client, config, outbox)
        elif args.scenario == "repair":
            run_repair(client, config, outbox)
        elif args.scenario == "full_demo":
            run_normal(client, config)
            time.sleep(args.delay)
            run_headlight_glitch(args.delay)
            time.sleep(args.delay)
            run_fault(client, config, outbox, args.delay)
            time.sleep(args.delay)
            run_offline_queue_replay(client, config, outbox)
            time.sleep(args.delay)
            run_repair(client, config, outbox)

        print("\n" + "=" * 65)
        print(" >>> SIMULATION COMPLETED SUCCESSFULLY! <<<")
        print("=" * 65 + "\n")

    finally:
        client.close()
        # Clean up temporary simulator database
        try:
            if os.path.exists(sim_db_path):
                os.remove(sim_db_path)
            for ext in ["-wal", "-shm"]:
                if os.path.exists(sim_db_path + ext):
                    os.remove(sim_db_path + ext)
        except Exception:
            pass


if __name__ == "__main__":
    main()

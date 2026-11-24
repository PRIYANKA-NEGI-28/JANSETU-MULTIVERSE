#include "communication.h"
#include "fsm.h"
#include "pins.h"
#include "button.h"
#include <stdio.h>
#include <string.h>

#ifdef ARDUINO
#include <Arduino.h>

#if __has_include(<Arduino_RouterBridge.h>)
#include <Arduino_RouterBridge.h>
#define HAVE_ROUTER_BRIDGE 1
#endif

#else
// Mock declarations for host testing
#include <iostream>
#endif

static char s_json_buffer[256];
static unsigned long s_last_heartbeat_time = 0;

size_t communication_build_telemetry_json(char* buffer, size_t max_len, unsigned long current_time_ms) {
    TelemetryData t = fsm_get_telemetry(current_time_ms);

    int written = snprintf(
        buffer,
        max_len,
        "{\"state\":\"%s\",\"ldr_raw\":%u,\"seq\":%lu,\"uptime_ms\":%lu,\"fault_duration_ms\":%lu}",
        t.state_str,
        (unsigned int)t.ldr_raw,
        (unsigned long)t.seq,
        t.uptime_ms,
        t.fault_duration_ms
    );

    if (written < 0 || (size_t)written >= max_len) {
        return 0;
    }
    return (size_t)written;
}

const char* communication_get_telemetry_json(unsigned long current_time_ms) {
    communication_build_telemetry_json(s_json_buffer, sizeof(s_json_buffer), current_time_ms);
    return s_json_buffer;
}

#ifdef ARDUINO

#if defined(HAVE_ROUTER_BRIDGE)
// RouterBridge RPC Callbacks
static String rpc_get_status(void) {
    return String(fsm_get_state_str());
}

static String rpc_get_telemetry(void) {
    return String(communication_get_telemetry_json(millis()));
}

static bool rpc_simulate_repair(void) {
    button_inject_press();
    return true;
}
#endif

void communication_init(void) {
#if defined(HAVE_ROUTER_BRIDGE)
    Bridge.begin();
    // Expose legacy plain string getter for backward compatibility
    Bridge.provide("get_status", rpc_get_status);
    // Expose structured JSON telemetry RPC getter
    Bridge.provide("get_telemetry", rpc_get_telemetry);
    // Expose remote repair action
    Bridge.provide("simulate_repair", rpc_simulate_repair);
#endif
    s_last_heartbeat_time = 0;
}

void communication_update(unsigned long current_time_ms) {
    // Process incoming Serial commands
    if (Serial.available() > 0) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        cmd.toUpperCase();

        if (cmd == "STATUS" || cmd == "GET_STATUS") {
            Serial.println(fsm_get_state_str());
        } else if (cmd == "TELEMETRY" || cmd == "GET" || cmd == "JSON") {
            Serial.println(communication_get_telemetry_json(current_time_ms));
        } else if (cmd == "REPAIR") {
            button_inject_press();
            Serial.println("OK: REPAIR_TRIGGERED");
        } else if (cmd == "RESET") {
            fsm_reset();
            Serial.println("OK: FSM_RESET");
        } else if (cmd.length() > 0) {
            Serial.println("{\"error\":\"UNKNOWN_COMMAND\",\"commands\":[\"STATUS\",\"TELEMETRY\",\"REPAIR\",\"RESET\"]}");
        }
    }

    // Periodic telemetry heartbeat broadcast over Serial
    if (current_time_ms - s_last_heartbeat_time >= TELEMETRY_HEARTBEAT_MS) {
        s_last_heartbeat_time = current_time_ms;
        Serial.print("[JANSETU-MCU] ");
        Serial.println(communication_get_telemetry_json(current_time_ms));
    }
}

#else

// Host test implementations
void communication_init(void) {
    s_last_heartbeat_time = 0;
}

void communication_update(unsigned long current_time_ms) {
    (void)current_time_ms;
}

#endif

/*
 * JanSetu Multiverse — Streetlight IoT Edge MCU Firmware
 * Target: Arduino UNO Q (Microcontroller MCU Core)
 *
 * Capabilities:
 * - 16-sample circular buffer rolling-average LDR sampling with hysteresis.
 * - Multi-stage Finite State Machine (NORMAL -> POSSIBLE_FAULT -> FAULT_CONFIRMED).
 * - Monotonic event sequence tracking (event_seq).
 * - Hardware debounced tactile repair simulation push button.
 * - Hardware Watchdog Timer (WDT) auto-recovery.
 * - RouterBridge RPC interface + USB Serial JSON telemetry.
 */

#include "pins.h"
#include "sensors.h"
#include "button.h"
#include "outputs.h"
#include "fsm.h"
#include "communication.h"

#if defined(__AVR__) || __has_include(<avr/wdt.h>)
#include <avr/wdt.h>
#define HAVE_WATCHDOG 1
#endif

void setup() {
#if defined(HAVE_WATCHDOG)
    // Clear watchdog reset flag on AVR to prevent reboot loops
    #if defined(MCUSR)
    MCUSR = 0;
    #endif
    wdt_disable();
#endif

    // Initialize serial communications for telemetry & debugging
    Serial.begin(115200);
    delay(100);

    Serial.println(F("========================================"));
    Serial.println(F(" JanSetu IoT Edge Node (Arduino UNO Q)  "));
    Serial.println(F(" Firmware v2.0 - Hardened FSM & RPC     "));
    Serial.println(F("========================================"));

    // Initialize hardware subsystems
    outputs_init();
    sensors_init();
    button_init();
    fsm_init();
    communication_init();

#if defined(HAVE_WATCHDOG)
    // Enable 4-second hardware watchdog timer
    wdt_enable(WDTO_4S);
    Serial.println(F("[WDT] Hardware Watchdog Timer enabled (4s)"));
#endif

    Serial.println(F("[SYS] System boot complete. Monitoring active."));
}

void loop() {
#if defined(HAVE_WATCHDOG)
    // Service/pet the hardware watchdog timer
    wdt_reset();
#endif

    unsigned long current_time_ms = millis();

    // 1. Update analog LDR rolling average & hysteresis
    sensors_update(current_time_ms);

    // 2. Sample debounced tactile repair button
    button_update(current_time_ms);

    // 3. Step Finite State Machine forward
    fsm_update(sensors_is_dark(), button_was_pressed(), current_time_ms);

    // 4. Update Red/Green/White indicator LEDs
    outputs_update_fsm_leds(fsm_get_state(), current_time_ms);

    // 5. Handle RouterBridge RPC & Serial telemetry commands
    communication_update(current_time_ms);
}

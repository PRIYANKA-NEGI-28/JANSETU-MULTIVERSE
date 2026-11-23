#ifndef JANSETU_PINS_H
#define JANSETU_PINS_H

#include <stdint.h>

/* =========================================================================
 * Arduino UNO Q Pinout Definitions
 * ========================================================================= */

// Analog Input
#ifndef A0
#define A0                       14
#endif
#define PIN_LDR                  A0    // LDR sensor voltage divider

// Digital Actuators / Indicator Outputs
#define PIN_LED_WHITE            9     // Streetlight luminaire simulator (PWM pin)
#define PIN_LED_GREEN            8     // System Normal indicator LED
#define PIN_LED_RED              7     // Fault / Warning indicator LED

// Digital Control Input
#define PIN_BTN_REPAIR           2     // Tactile repair simulation button (Interrupt D2)

/* =========================================================================
 * Sensor Thresholds & Filtering Constants
 * ========================================================================= */

// Hysteresis thresholds for 10-bit ADC (0 - 1023)
// Dark threshold: Below this value, lamp is dark / unlit
#define THRESHOLD_DARK           350

// Light threshold: Above this value, lamp is sufficiently illuminated
#define THRESHOLD_LIGHT          550

// Rolling average window size (power-of-two for efficient circular buffer)
#define LDR_WINDOW_SIZE          16

// LDR sensor sampling interval in milliseconds
#define LDR_SAMPLE_INTERVAL_MS   50

/* =========================================================================
 * FSM Timing & Debounce Constants
 * ========================================================================= */

// Fault validation window (5000 ms = 5.0 s)
// Darkness must persist continuously for this duration to confirm failure,
// effectively filtering transient shadows, bird perches, and cloud cover.
#define FAULT_VALIDATION_TIME_MS 5000

// Push button hardware debounce stabilization time (milliseconds)
#define DEBOUNCE_DELAY_MS        50

// Indicator LED blink interval during POSSIBLE_FAULT state (milliseconds)
#define BLINK_INTERVAL_FAST_MS   250

// Telemetry heartbeat broadcast interval over Serial (milliseconds)
#define TELEMETRY_HEARTBEAT_MS   2000

#endif // JANSETU_PINS_H

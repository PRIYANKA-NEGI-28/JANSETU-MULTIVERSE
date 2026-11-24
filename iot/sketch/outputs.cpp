#include "outputs.h"
#include "pins.h"

#ifdef ARDUINO
#include <Arduino.h>
#else
// Mock declarations for host testing
extern uint8_t mock_digital_pins[14];
static inline void pinMode(uint8_t pin, uint8_t mode) { (void)pin; (void)mode; }
static inline void digitalWrite(uint8_t pin, uint8_t val) {
    if (pin < 14) mock_digital_pins[pin] = val;
}
#define OUTPUT 1
#define LOW 0
#define HIGH 1
#endif

static unsigned long s_last_blink_time = 0;
static bool s_blink_state = false;

void outputs_init(void) {
    pinMode(PIN_LED_WHITE, OUTPUT);
    pinMode(PIN_LED_GREEN, OUTPUT);
    pinMode(PIN_LED_RED, OUTPUT);

    // Initial state: Luminaire ON, Green ON, Red OFF
    digitalWrite(PIN_LED_WHITE, HIGH);
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_RED, LOW);

    s_last_blink_time = 0;
    s_blink_state = false;
}

void outputs_set_white_led(bool on) {
    digitalWrite(PIN_LED_WHITE, on ? HIGH : LOW);
}

void outputs_set_green_led(bool on) {
    digitalWrite(PIN_LED_GREEN, on ? HIGH : LOW);
}

void outputs_set_red_led(bool on) {
    digitalWrite(PIN_LED_RED, on ? HIGH : LOW);
}

void outputs_update_fsm_leds(FsmState state, unsigned long current_time_ms) {
    // Streetlight Luminaire remains commanded ON
    digitalWrite(PIN_LED_WHITE, HIGH);

    switch (state) {
        case STATE_NORMAL:
            digitalWrite(PIN_LED_GREEN, HIGH);
            digitalWrite(PIN_LED_RED, LOW);
            s_blink_state = false;
            break;

        case STATE_POSSIBLE_FAULT:
            digitalWrite(PIN_LED_GREEN, LOW);
            if (current_time_ms - s_last_blink_time >= BLINK_INTERVAL_FAST_MS) {
                s_last_blink_time = current_time_ms;
                s_blink_state = !s_blink_state;
            }
            digitalWrite(PIN_LED_RED, s_blink_state ? HIGH : LOW);
            break;

        case STATE_FAULT_CONFIRMED:
            digitalWrite(PIN_LED_GREEN, LOW);
            digitalWrite(PIN_LED_RED, HIGH);
            s_blink_state = false;
            break;

        default:
            digitalWrite(PIN_LED_GREEN, LOW);
            digitalWrite(PIN_LED_RED, LOW);
            break;
    }
}

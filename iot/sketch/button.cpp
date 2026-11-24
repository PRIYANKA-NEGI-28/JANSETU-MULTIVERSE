#include "button.h"
#include "pins.h"

#ifdef ARDUINO
#include <Arduino.h>
#else
// Mock declarations for host testing
extern int mock_digital_read_btn;
static inline int digitalRead(uint8_t pin) { (void)pin; return mock_digital_read_btn; }
static inline void pinMode(uint8_t pin, uint8_t mode) { (void)pin; (void)mode; }
#define INPUT_PULLUP 2
#define LOW 0
#define HIGH 1
#endif

// Button is active LOW when configured with INPUT_PULLUP
static int s_last_reading = HIGH;
static int s_stable_state = HIGH;
static unsigned long s_last_debounce_time = 0;
static bool s_pressed_event = false;

void button_init(void) {
    pinMode(PIN_BTN_REPAIR, INPUT_PULLUP);
    s_last_reading = HIGH;
    s_stable_state = HIGH;
    s_last_debounce_time = 0;
    s_pressed_event = false;
}

void button_update(unsigned long current_time_ms) {
    int reading = digitalRead(PIN_BTN_REPAIR);

    if (reading != s_last_reading) {
        s_last_debounce_time = current_time_ms;
    }
    s_last_reading = reading;

    if ((current_time_ms - s_last_debounce_time) >= DEBOUNCE_DELAY_MS) {
        if (reading != s_stable_state) {
            s_stable_state = reading;
            // Active-LOW falling edge indicates button press
            if (s_stable_state == LOW) {
                s_pressed_event = true;
            }
        }
    }
}

bool button_was_pressed(void) {
    if (s_pressed_event) {
        s_pressed_event = false;
        return true;
    }
    return false;
}

void button_inject_press(void) {
    s_pressed_event = true;
}

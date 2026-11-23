#include "sensors.h"
#include "pins.h"

#ifdef ARDUINO
#include <Arduino.h>
#else
// Mock declarations for native host compilation and unit tests
extern uint16_t mock_analog_read_val;
static inline uint16_t analogRead(uint8_t pin) { (void)pin; return mock_analog_read_val; }
#endif

static uint16_t s_samples[LDR_WINDOW_SIZE];
static uint32_t s_sample_sum = 0;
static uint8_t s_sample_index = 0;
static uint8_t s_sample_count = 0;

static uint16_t s_last_raw = 0;
static uint16_t s_filtered_value = 0;
static bool s_is_dark_state = false;
static unsigned long s_last_sample_time = 0;

void sensors_init(void) {
    s_sample_sum = 0;
    s_sample_index = 0;
    s_sample_count = 0;
    s_last_sample_time = 0;

    // Take initial reading to seed circular buffer
    s_last_raw = analogRead(PIN_LDR);
    for (uint8_t i = 0; i < LDR_WINDOW_SIZE; ++i) {
        s_samples[i] = s_last_raw;
        s_sample_sum += s_last_raw;
    }
    s_sample_count = LDR_WINDOW_SIZE;
    s_filtered_value = s_last_raw;

    // Initial hysteresis determination
    s_is_dark_state = (s_filtered_value < THRESHOLD_DARK);
}

void sensors_update(unsigned long current_time_ms) {
    // Non-blocking sampling timer
    if (current_time_ms - s_last_sample_time < LDR_SAMPLE_INTERVAL_MS && s_sample_count > 0) {
        return;
    }
    s_last_sample_time = current_time_ms;

    s_last_raw = analogRead(PIN_LDR);

    // Update rolling average circular buffer
    s_sample_sum -= s_samples[s_sample_index];
    s_samples[s_sample_index] = s_last_raw;
    s_sample_sum += s_last_raw;

    s_sample_index = (s_sample_index + 1) % LDR_WINDOW_SIZE;
    if (s_sample_count < LDR_WINDOW_SIZE) {
        s_sample_count++;
    }

    s_filtered_value = (uint16_t)(s_sample_sum / s_sample_count);

    // Hysteresis threshold logic
    if (s_filtered_value < THRESHOLD_DARK) {
        s_is_dark_state = true;
    } else if (s_filtered_value > THRESHOLD_LIGHT) {
        s_is_dark_state = false;
    }
    // Between THRESHOLD_DARK and THRESHOLD_LIGHT, s_is_dark_state is preserved
}

uint16_t sensors_get_raw_ldr(void) {
    return s_last_raw;
}

uint16_t sensors_get_filtered_ldr(void) {
    return s_filtered_value;
}

bool sensors_is_dark(void) {
    return s_is_dark_state;
}

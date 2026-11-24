#include "fsm.h"
#include "pins.h"
#include "sensors.h"

static FsmState s_state = STATE_NORMAL;
static uint32_t s_event_seq = 1;
static unsigned long s_fault_candidate_start_time = 0;
static unsigned long s_fault_confirmed_start_time = 0;

void fsm_init(void) {
    s_state = STATE_NORMAL;
    s_event_seq = 1;
    s_fault_candidate_start_time = 0;
    s_fault_confirmed_start_time = 0;
}

void fsm_reset(void) {
    fsm_init();
}

void fsm_update(bool is_dark, bool repair_pressed, unsigned long current_time_ms) {
    switch (s_state) {
        case STATE_NORMAL:
            // Streetlight failure candidate: darkness detected while light commanded ON
            if (is_dark) {
                s_state = STATE_POSSIBLE_FAULT;
                s_fault_candidate_start_time = current_time_ms;
                s_event_seq++;
            }
            break;

        case STATE_POSSIBLE_FAULT:
            // 1. Spurious trigger filter: Light restored before validation countdown expires
            // (e.g. car headlights passed, cloud cleared)
            if (!is_dark) {
                s_state = STATE_NORMAL;
                s_fault_candidate_start_time = 0;
                s_event_seq++;
            }
            // 2. Manual repair button aborts validation back to NORMAL
            else if (repair_pressed) {
                s_state = STATE_NORMAL;
                s_fault_candidate_start_time = 0;
                s_event_seq++;
            }
            // 3. Persistent darkness expired validation window -> Confirm persistent failure
            else if ((current_time_ms - s_fault_candidate_start_time) >= FAULT_VALIDATION_TIME_MS) {
                s_state = STATE_FAULT_CONFIRMED;
                s_fault_confirmed_start_time = current_time_ms;
                s_event_seq++;
            }
            break;

        case STATE_FAULT_CONFIRMED:
            // Recovery Condition A: Field technician presses tactile repair push button
            // Recovery Condition B: Physical daylight / ambient lighting restored
            if (repair_pressed || !is_dark) {
                s_state = STATE_NORMAL;
                s_fault_candidate_start_time = 0;
                s_fault_confirmed_start_time = 0;
                s_event_seq++;
            }
            break;

        default:
            s_state = STATE_NORMAL;
            break;
    }
}

FsmState fsm_get_state(void) {
    return s_state;
}

const char* fsm_get_state_str(void) {
    switch (s_state) {
        case STATE_NORMAL:
            return "NORMAL";
        case STATE_POSSIBLE_FAULT:
            return "POSSIBLE_FAULT";
        case STATE_FAULT_CONFIRMED:
            return "FAULT_CONFIRMED";
        default:
            return "UNKNOWN";
    }
}

uint32_t fsm_get_seq(void) {
    return s_event_seq;
}

unsigned long fsm_get_fault_duration_ms(unsigned long current_time_ms) {
    if (s_state == STATE_FAULT_CONFIRMED) {
        if (current_time_ms >= s_fault_confirmed_start_time) {
            return current_time_ms - s_fault_confirmed_start_time;
        }
        return 0;
    }
    return 0;
}

unsigned long fsm_get_countdown_remaining_ms(unsigned long current_time_ms) {
    if (s_state == STATE_POSSIBLE_FAULT) {
        unsigned long elapsed = current_time_ms - s_fault_candidate_start_time;
        if (elapsed < FAULT_VALIDATION_TIME_MS) {
            return FAULT_VALIDATION_TIME_MS - elapsed;
        }
    }
    return 0;
}

TelemetryData fsm_get_telemetry(unsigned long current_time_ms) {
    TelemetryData t;
    t.state = s_state;
    t.state_str = fsm_get_state_str();
    t.ldr_raw = sensors_get_raw_ldr();
    t.ldr_filtered = sensors_get_filtered_ldr();
    t.seq = s_event_seq;
    t.uptime_ms = current_time_ms;
    t.fault_duration_ms = fsm_get_fault_duration_ms(current_time_ms);
    t.validation_countdown_remaining_ms = fsm_get_countdown_remaining_ms(current_time_ms);
    return t;
}

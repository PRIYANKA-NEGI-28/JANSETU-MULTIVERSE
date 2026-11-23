#ifndef JANSETU_FSM_H
#define JANSETU_FSM_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    STATE_NORMAL = 0,
    STATE_POSSIBLE_FAULT = 1,
    STATE_FAULT_CONFIRMED = 2
} FsmState;

typedef struct {
    FsmState state;
    const char* state_str;
    uint16_t ldr_raw;
    uint16_t ldr_filtered;
    uint32_t seq;
    unsigned long uptime_ms;
    unsigned long fault_duration_ms;
    unsigned long validation_countdown_remaining_ms;
} TelemetryData;

/**
 * Initialize Finite State Machine to initial STATE_NORMAL.
 */
void fsm_init(void);

/**
 * Step FSM logic forward given sensor and input event indicators.
 *
 * @param is_dark Whether the LDR currently registers darkness below threshold.
 * @param repair_pressed Whether the tactile repair push button was pressed.
 * @param current_time_ms Monotonic millisecond timestamp.
 */
void fsm_update(bool is_dark, bool repair_pressed, unsigned long current_time_ms);

/**
 * Get current discrete FSM state.
 */
FsmState fsm_get_state(void);

/**
 * Get current state string representation ("NORMAL", "POSSIBLE_FAULT", "FAULT_CONFIRMED").
 */
const char* fsm_get_state_str(void);

/**
 * Get monotonic event sequence counter. Increments on every state transition.
 */
uint32_t fsm_get_seq(void);

/**
 * Returns duration (ms) the device has spent in FAULT_CONFIRMED state.
 * Returns 0 if not currently in FAULT_CONFIRMED.
 */
unsigned long fsm_get_fault_duration_ms(unsigned long current_time_ms);

/**
 * Returns remaining milliseconds in the validation countdown window.
 * Returns 0 if not in POSSIBLE_FAULT state.
 */
unsigned long fsm_get_countdown_remaining_ms(unsigned long current_time_ms);

/**
 * Build consolidated telemetry snapshot.
 */
TelemetryData fsm_get_telemetry(unsigned long current_time_ms);

/**
 * Reset FSM to initial NORMAL state and reset sequence/timers.
 */
void fsm_reset(void);

#ifdef __cplusplus
}
#endif

#endif // JANSETU_FSM_H

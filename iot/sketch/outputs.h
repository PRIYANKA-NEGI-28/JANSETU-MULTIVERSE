#ifndef JANSETU_OUTPUTS_H
#define JANSETU_OUTPUTS_H

#include <stdbool.h>
#include "fsm.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Configure output pins for White, Green, and Red LEDs.
 */
void outputs_init(void);

/**
 * Directly control White LED (Streetlight Luminaire simulator).
 */
void outputs_set_white_led(bool on);

/**
 * Directly control Green LED (Normal status).
 */
void outputs_set_green_led(bool on);

/**
 * Directly control Red LED (Fault status).
 */
void outputs_set_red_led(bool on);

/**
 * Periodic LED state updater according to FSM state.
 * - NORMAL: White ON, Green ON, Red OFF.
 * - POSSIBLE_FAULT: White ON, Green OFF, Red BLINKING (250ms).
 * - FAULT_CONFIRMED: White ON, Green OFF, Red SOLID ON.
 *
 * @param state Current FSM state.
 * @param current_time_ms Current monotonic millisecond timestamp.
 */
void outputs_update_fsm_leds(FsmState state, unsigned long current_time_ms);

#ifdef __cplusplus
}
#endif

#endif // JANSETU_OUTPUTS_H

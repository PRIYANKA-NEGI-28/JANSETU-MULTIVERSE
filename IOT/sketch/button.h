#ifndef JANSETU_BUTTON_H
#define JANSETU_BUTTON_H

#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Configure tactile push button pin with internal pull-up.
 */
void button_init(void);

/**
 * Non-blocking debouncing sampler.
 *
 * @param current_time_ms Monotonic millisecond timestamp.
 */
void button_update(unsigned long current_time_ms);

/**
 * Edge detector query: returns true exactly once when button transitions
 * from released to pressed.
 */
bool button_was_pressed(void);

/**
 * Programmatically inject a simulated button press event (for RPC/testing).
 */
void button_inject_press(void);

#ifdef __cplusplus
}
#endif

#endif // JANSETU_BUTTON_H

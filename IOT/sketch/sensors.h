#ifndef JANSETU_SENSORS_H
#define JANSETU_SENSORS_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Initialize LDR sensor input pin and rolling average circular buffer.
 */
void sensors_init(void);

/**
 * Periodic sampling update. Should be called frequently in main loop.
 * Samples ADC every LDR_SAMPLE_INTERVAL_MS and updates rolling average.
 *
 * @param current_time_ms Current monotonic millisecond timestamp (millis()).
 */
void sensors_update(unsigned long current_time_ms);

/**
 * Returns the most recent raw 10-bit ADC reading from the LDR pin (0 - 1023).
 */
uint16_t sensors_get_raw_ldr(void);

/**
 * Returns the rolling average filtered LDR reading (0 - 1023).
 */
uint16_t sensors_get_filtered_ldr(void);

/**
 * Evaluates whether the current illumination indicates darkness using hysteresis.
 * - Transitions to DARK (true) when filtered LDR < THRESHOLD_DARK (350).
 * - Transitions to LIGHT (false) when filtered LDR > THRESHOLD_LIGHT (550).
 * - Retains previous state within the 350-550 deadband to prevent flickering.
 */
bool sensors_is_dark(void);

#ifdef __cplusplus
}
#endif

#endif // JANSETU_SENSORS_H

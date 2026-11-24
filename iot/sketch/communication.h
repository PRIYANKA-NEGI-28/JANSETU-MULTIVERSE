#ifndef JANSETU_COMMUNICATION_H
#define JANSETU_COMMUNICATION_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Initialize RouterBridge RPC handlers and Serial transport.
 */
void communication_init(void);

/**
 * Periodic communication task (processes Serial commands & heartbeat).
 *
 * @param current_time_ms Current monotonic millisecond timestamp.
 */
void communication_update(unsigned long current_time_ms);

/**
 * Formats structured telemetry JSON into provided buffer.
 * Schema: { state, ldr_raw, seq, uptime_ms, fault_duration_ms }
 *
 * @param buffer Output char buffer.
 * @param max_len Maximum length of buffer.
 * @param current_time_ms Monotonic millisecond timestamp.
 * @return Number of characters written.
 */
size_t communication_build_telemetry_json(char* buffer, size_t max_len, unsigned long current_time_ms);

/**
 * Direct C-string getter for structured telemetry payload.
 * Returns pointer to internal static buffer containing formatted JSON.
 */
const char* communication_get_telemetry_json(unsigned long current_time_ms);

#ifdef __cplusplus
}
#endif

#endif // JANSETU_COMMUNICATION_H

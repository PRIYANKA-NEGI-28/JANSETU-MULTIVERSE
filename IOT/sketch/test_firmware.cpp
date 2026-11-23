#include <iostream>
#include <cassert>
#include <cstring>
#include <string>
#include "pins.h"
#include "sensors.h"
#include "button.h"
#include "outputs.h"
#include "fsm.h"
#include "communication.h"

// Mock state variables for host compilation
uint16_t mock_analog_read_val = 800; // default bright light
int mock_digital_read_btn = 1;       // default released (HIGH with pull-up)
uint8_t mock_digital_pins[14] = {0};

void test_rolling_average_and_hysteresis() {
    std::cout << "[TEST] 1. Rolling-Average LDR Sampling & Hysteresis... ";

    mock_analog_read_val = 800;
    sensors_init();
    assert(sensors_get_filtered_ldr() == 800);
    assert(!sensors_is_dark());

    // Transient dip for 1 sample (e.g. 100ms passing bird/shadow)
    mock_analog_read_val = 200;
    sensors_update(50);
    // Average should still be well above 350 due to 16-sample buffer
    // 15 * 800 + 200 = 12200 / 16 = 762
    assert(sensors_get_filtered_ldr() > 700);
    assert(!sensors_is_dark());

    // Continuous darkness for 16 samples
    for (int i = 1; i <= 16; ++i) {
        sensors_update(50 + i * 50);
    }
    assert(sensors_get_filtered_ldr() == 200);
    assert(sensors_is_dark()); // Triggered DARK because 200 < THRESHOLD_DARK (350)

    // Intermediate light in deadband (e.g. 450)
    mock_analog_read_val = 450;
    for (int i = 1; i <= 16; ++i) {
        sensors_update(1000 + i * 50);
    }
    assert(sensors_get_filtered_ldr() == 450);
    // Hysteresis deadband: should REMAIN DARK because 450 is not above THRESHOLD_LIGHT (550)
    assert(sensors_is_dark());

    // Bright daylight restored (700)
    mock_analog_read_val = 700;
    for (int i = 1; i <= 16; ++i) {
        sensors_update(2000 + i * 50);
    }
    assert(sensors_get_filtered_ldr() == 700);
    assert(!sensors_is_dark()); // Cleared DARK because 700 > THRESHOLD_LIGHT (550)

    std::cout << "PASSED\n";
}

void test_button_debouncing() {
    std::cout << "[TEST] 2. Push Button Hardware Debounce... ";

    button_init();
    assert(!button_was_pressed());

    // Mechanical contact bounce (rapid 0/1 oscillations < 50ms)
    mock_digital_read_btn = 0; // contact closed
    button_update(10);
    assert(!button_was_pressed()); // Not yet debounced

    mock_digital_read_btn = 1; // contact bounce open
    button_update(20);
    assert(!button_was_pressed());

    mock_digital_read_btn = 0; // contact settled closed
    button_update(30);
    assert(!button_was_pressed());

    // Time elapsed exceeds 50ms debounce threshold
    button_update(85);
    assert(button_was_pressed()); // Edge detected!
    assert(!button_was_pressed()); // Subsequent query returns false (single trigger)

    // Release button
    mock_digital_read_btn = 1;
    button_update(100);
    button_update(160);
    assert(!button_was_pressed());

    std::cout << "PASSED\n";
}

void test_fsm_validation_countdown_and_recovery() {
    std::cout << "[TEST] 3. FSM Validation Countdown & Transitions... ";

    fsm_init();
    assert(fsm_get_state() == STATE_NORMAL);
    assert(std::string(fsm_get_state_str()) == "NORMAL");
    uint32_t seq1 = fsm_get_seq();

    // Darkness detected -> transitions to POSSIBLE_FAULT
    fsm_update(true, false, 1000);
    assert(fsm_get_state() == STATE_POSSIBLE_FAULT);
    assert(std::string(fsm_get_state_str()) == "POSSIBLE_FAULT");
    assert(fsm_get_seq() == seq1 + 1);
    uint32_t seq2 = fsm_get_seq();

    // Car headlight sweeps past after 2 seconds (light restored before 5s timeout)
    fsm_update(false, false, 3000);
    assert(fsm_get_state() == STATE_NORMAL);
    assert(fsm_get_seq() == seq2 + 1);
    uint32_t seq3 = fsm_get_seq();

    // Darkness returns at t=4000
    fsm_update(true, false, 4000);
    assert(fsm_get_state() == STATE_POSSIBLE_FAULT);
    assert(fsm_get_seq() == seq3 + 1);
    uint32_t seq4 = fsm_get_seq();

    // Countdown active at t=6000 (2000ms elapsed out of 5000ms)
    fsm_update(true, false, 6000);
    assert(fsm_get_state() == STATE_POSSIBLE_FAULT);
    assert(fsm_get_countdown_remaining_ms(6000) == 3000);
    assert(fsm_get_seq() == seq4); // No state transition -> sequence unchanged

    // Countdown reaches 5000ms at t=9000
    fsm_update(true, false, 9000);
    assert(fsm_get_state() == STATE_FAULT_CONFIRMED);
    assert(std::string(fsm_get_state_str()) == "FAULT_CONFIRMED");
    assert(fsm_get_seq() == seq4 + 1);
    assert(fsm_get_countdown_remaining_ms(9000) == 0);
    assert(fsm_get_fault_duration_ms(12000) == 3000); // 12000 - 9000 = 3000ms in fault
    uint32_t seq5 = fsm_get_seq();

    // Recovery test A: Press repair button
    fsm_update(true, true, 14000);
    assert(fsm_get_state() == STATE_NORMAL);
    assert(fsm_get_seq() == seq5 + 1);
    assert(fsm_get_fault_duration_ms(14000) == 0);

    // Re-verify Recovery test B: Restored daylight recovers from FAULT_CONFIRMED
    fsm_update(true, false, 15000);
    fsm_update(true, false, 20000); // Confirmed fault
    assert(fsm_get_state() == STATE_FAULT_CONFIRMED);
    fsm_update(false, false, 21000); // Daylight restored
    assert(fsm_get_state() == STATE_NORMAL);

    std::cout << "PASSED\n";
}

void test_structured_rpc_telemetry() {
    std::cout << "[TEST] 4. Structured RPC Telemetry Serialization... ";

    fsm_init();
    mock_analog_read_val = 742;
    sensors_init();

    char buf[256];
    size_t len = communication_build_telemetry_json(buf, sizeof(buf), 15000);
    assert(len > 0);

    std::string json(buf);
    assert(json.find("\"state\":\"NORMAL\"") != std::string::npos);
    assert(json.find("\"ldr_raw\":742") != std::string::npos);
    assert(json.find("\"seq\":1") != std::string::npos);
    assert(json.find("\"uptime_ms\":15000") != std::string::npos);
    assert(json.find("\"fault_duration_ms\":0") != std::string::npos);

    // Advance to confirmed fault
    fsm_update(true, false, 20000);
    fsm_update(true, false, 25000);
    mock_analog_read_val = 150;
    sensors_update(25000);

    const char* str = communication_get_telemetry_json(28000);
    std::string fault_json(str);
    assert(fault_json.find("\"state\":\"FAULT_CONFIRMED\"") != std::string::npos);
    assert(fault_json.find("\"fault_duration_ms\":3000") != std::string::npos); // 28000 - 25000 = 3000ms

    std::cout << "PASSED\n";
}

void test_outputs_leds() {
    std::cout << "[TEST] 5. Outputs and LED Indication... ";

    outputs_init();
    assert(mock_digital_pins[PIN_LED_WHITE] == 1);
    assert(mock_digital_pins[PIN_LED_GREEN] == 1);
    assert(mock_digital_pins[PIN_LED_RED] == 0);

    // In POSSIBLE_FAULT, red LED should blink
    outputs_update_fsm_leds(STATE_POSSIBLE_FAULT, 100);
    assert(mock_digital_pins[PIN_LED_GREEN] == 0);

    // In FAULT_CONFIRMED, red LED solid
    outputs_update_fsm_leds(STATE_FAULT_CONFIRMED, 200);
    assert(mock_digital_pins[PIN_LED_GREEN] == 0);
    assert(mock_digital_pins[PIN_LED_RED] == 1);

    // Return to NORMAL
    outputs_update_fsm_leds(STATE_NORMAL, 300);
    assert(mock_digital_pins[PIN_LED_GREEN] == 1);
    assert(mock_digital_pins[PIN_LED_RED] == 0);

    std::cout << "PASSED\n";
}

int main() {
    std::cout << "\n========================================\n";
    std::cout << " JanSetu MCU Firmware Unit Verification \n";
    std::cout << "========================================\n";

    test_rolling_average_and_hysteresis();
    test_button_debouncing();
    test_fsm_validation_countdown_and_recovery();
    test_structured_rpc_telemetry();
    test_outputs_leds();

    std::cout << "\n>>> ALL 5 MCU FIRMWARE TEST SUITES PASSED SUCCESSFULLY! <<<\n\n";
    return 0;
}

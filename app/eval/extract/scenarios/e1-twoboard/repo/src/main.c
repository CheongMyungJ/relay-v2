/*
 * main.c - thermostat controller main loop
 */
#include "board.h"
#include "timer.h"
#include "uart.h"
#include "proto.h"
#include "adc.h"
#include "control.h"
#include "fault.h"
#include "eeprom.h"
#include "wdt.h"
#include "hwrev.h"
#if CFG_FEATURE_FAN
#include "fan.h"
#endif

int main(void)
{
    uint32_t last_ctrl;
    uint8_t boot_faults;

    timer_init();
    hwrev_init();
    control_init();
    uart_init();
    adc_init();
#if CFG_FEATURE_FAN
    fan_init();
#endif

    boot_faults = ee_load();
    if (boot_faults) {
        fault_handle_boot(boot_faults);
    }
    wdt_init();

    last_ctrl = timer_now();
    for (;;) {
        proto_poll();
        ee_poll();
        if ((timer_now() - last_ctrl) >= CTRL_PERIOD_TICKS) {
            last_ctrl += CTRL_PERIOD_TICKS;
            control_step();
        }
#if CFG_FEATURE_FAN
        fan_poll();
#endif
        wdt_kick();
    }
}

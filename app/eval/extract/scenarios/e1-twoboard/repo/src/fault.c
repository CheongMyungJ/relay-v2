/*
 * fault.c - fault flags and boot-time recovery
 */
#include "fault.h"
#include "board.h"
#include "control.h"

volatile uint8_t g_fault_flags;

void fault_raise(uint8_t flags)
{
    __disable_irq();
    g_fault_flags |= flags;
    __enable_irq();
}

void fault_clear(uint8_t mask)
{
    g_fault_flags &= (uint8_t)~mask;
}

static void restore_defaults(void)
{
    g_setpoint_dc = SETPOINT_DEFAULT_DC;
    g_mode = MODE_HEAT;
}

static void keep_running(void)
{
}

typedef void (*fault_action_t)(void);

/* action per fault bit, run once at boot for faults found while loading settings */
static const fault_action_t fault_actions[8] = {
    keep_running,       /* FAULT_OVERTEMP */
    keep_running,       /* FAULT_SENSOR */
    keep_running,       /* FAULT_HEATER_TIMEOUT */
    keep_running,       /* FAULT_EEPROM */
    restore_defaults,   /* FAULT_CFG_CRC */
    keep_running,
    keep_running,
    keep_running,
};

void fault_handle_boot(uint8_t boot_faults)
{
    for (uint8_t bit = 0; bit < 8U; bit++) {
        if (boot_faults & (1U << bit)) {
            fault_actions[bit]();
        }
    }
    fault_raise(boot_faults);
}

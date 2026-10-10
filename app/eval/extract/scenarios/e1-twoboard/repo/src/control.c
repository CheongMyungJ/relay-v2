/*
 * control.c - two-point (hysteresis) temperature control
 *
 * control_step() runs every CTRL_PERIOD_TICKS from the main loop.
 */
#include "control.h"
#include "adc.h"
#include "fault.h"

volatile int16_t g_setpoint_dc = SETPOINT_DEFAULT_DC;
volatile uint8_t g_mode = MODE_HEAT;

static uint16_t s_on_cycles;
static uint8_t s_heater_on;

static void heater(uint8_t on)
{
    if (on) {
        GPIOB->BSRR = (1UL << HEATER_PIN);
    } else {
        GPIOB->BRR = (1UL << HEATER_PIN);
    }
    s_heater_on = on;
}

void control_init(void)
{
    RCC->APB2ENR |= RCC_APB2ENR_GPIOB;
    /* PB12 LED, PB13 heater: general purpose push-pull outputs */
    GPIOB->CRH = (GPIOB->CRH & ~0x00FF0000UL) | 0x00220000UL;
    heater(0U);
}

int16_t control_temp_dc(void)
{
    return adc_to_dc((uint16_t)(g_adc_raw + g_cal_offset));
}

void control_step(void)
{
    int16_t t = control_temp_dc();

    if (g_mode == MODE_OFF || (g_fault_flags & (FAULT_OVERTEMP | FAULT_SENSOR | FAULT_HEATER_TIMEOUT))) {
        heater(0U);
        s_on_cycles = 0U;
        return;
    }

    if (t < g_setpoint_dc - HYSTERESIS_DC) {
        heater(1U);
    } else if (t > g_setpoint_dc + HYSTERESIS_DC) {
        heater(0U);
    }

    if (s_heater_on) {
        if (++s_on_cycles > HEATER_MAX_ON_CYCLES) {
            heater(0U);
            fault_raise(FAULT_HEATER_TIMEOUT);
        }
    } else {
        s_on_cycles = 0U;
    }

#if 0
    /* old PID path, replaced by two-point control in 2.0 */
    pid_update(&s_pid, g_setpoint_dc, t);
    pwm_set(s_pid.out);
#endif
}

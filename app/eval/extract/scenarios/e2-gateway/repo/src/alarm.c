/*
 * alarm.c - temperature alarm relay
 *
 * The relay on PB0 closes when channel 0 stays above the high threshold (or below the
 * low threshold) for ALARM_DELAY_MS, and opens again once the value is back inside
 * the band by ALARM_HYST_DC. Evaluated by the sensor task after each filter update.
 */
#include "alarm.h"
#include "board.h"
#include "misc.h"

#define ALARM_DELAY_MS      5000U
#define ALARM_HYST_DC       20      /* 2.0 C */
#define RELAY_PORT          GPIOB
#define RELAY_PIN           0U

static uint8_t s_state;             /* 0 normal, 1 high, 2 low */
static uint8_t s_pending;
static uint32_t s_since_ms;

void alarm_init(void)
{
    hal_gpio_mode(RELAY_PORT, RELAY_PIN, HAL_GPIO_OUTPUT);
    hal_gpio_write(RELAY_PORT, RELAY_PIN, 0);
}

static void relay(int closed)
{
    hal_gpio_write(RELAY_PORT, RELAY_PIN, closed);
}

void alarm_update(int16_t value, int16_t high, int16_t low)
{
    uint8_t want;

    if (s_state == 1U) {
        want = (value < high - ALARM_HYST_DC) ? 0U : 1U;
    } else if (s_state == 2U) {
        want = (value > low + ALARM_HYST_DC) ? 0U : 2U;
    } else if (value > high) {
        want = 1U;
    } else if (value < low) {
        want = 2U;
    } else {
        want = 0U;
    }

    if (want == s_state) {
        s_pending = 0U;
        return;
    }
    if (want == 0U) {
        /* clearing is immediate */
        s_state = 0U;
        s_pending = 0U;
        relay(0);
        return;
    }
    if (!s_pending) {
        s_pending = 1U;
        s_since_ms = timebase_ms();
        return;
    }
    if ((uint32_t)(timebase_ms() - s_since_ms) >= ALARM_DELAY_MS) {
        s_state = want;
        s_pending = 0U;
        relay(1);
    }
}

uint8_t alarm_state(void)
{
    return s_state;
}

/*
 * wdog.c - task supervision and the independent watchdog
 *
 * Each supervised task calls wdog_alive() at least every WDOG_CHECK_MS. The watchdog
 * task reloads the IWDG only when every supervised task has checked in since the last
 * check. The IWDG runs from the LSI oscillator (nominal 32 kHz): with /64 and a
 * reload of 1000 it expires after about 2 s.
 *
 * The watchdog task also keeps the uptime counter from the timebase EV_SECOND events.
 */
#include "misc.h"
#include "app.h"
#include "regs.h"
#include "board.h"

#define IWDG_PRESCALER_DIV64    4U
#define IWDG_RELOAD             1000U

#if CFG_FEATURE_LOGGER
#define WDOG_ALL    (WDOG_COMM | WDOG_SENSOR | WDOG_LOGGER)
#else
#define WDOG_ALL    (WDOG_COMM | WDOG_SENSOR)
#endif

static volatile uint32_t s_alive;

void wdog_init(void)
{
    RCC->CSR |= RCC_CSR_LSION;
    while ((RCC->CSR & RCC_CSR_LSIRDY) == 0U) {
    }
    IWDG->KR = IWDG_KEY_ACCESS;
    IWDG->PR = IWDG_PRESCALER_DIV64;
    IWDG->RLR = IWDG_RELOAD;
    IWDG->KR = IWDG_KEY_RELOAD;
    IWDG->KR = IWDG_KEY_ENABLE;
}

void wdog_alive(uint32_t who)
{
    uint32_t state = port_enter_critical();
    s_alive |= who;
    port_exit_critical(state);
}

void wdog_task(void *arg)
{
    tick_t last_check = task_tick_count();
    (void)arg;

    for (;;) {
        enum app_event ev;
        if (queue_receive(g_event_q, &ev, pdMS_TO_TICKS(WDOG_CHECK_MS)) == pdPASS && ev == EV_SECOND) {
            g_uptime_s++;
            board_led((int)(g_uptime_s & 1U));
        }
        if ((tick_t)(task_tick_count() - last_check) < pdMS_TO_TICKS(WDOG_CHECK_MS)) {
            continue;
        }
        last_check = task_tick_count();
        uint32_t state = port_enter_critical();
        uint32_t alive = s_alive;
        s_alive = 0;
        port_exit_critical(state);
        if ((alive & WDOG_ALL) == WDOG_ALL) {
            IWDG->KR = IWDG_KEY_RELOAD;
        }
    }
}

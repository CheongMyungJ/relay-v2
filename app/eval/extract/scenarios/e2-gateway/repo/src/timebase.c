/*
 * timebase.c - 1 kHz millisecond counter on TIM7
 *
 * Independent of the RTOS tick so that uptime and alarm timing do not depend on the
 * kernel configuration. Once per second the interrupt posts EV_SECOND to the
 * watchdog task, which keeps the uptime counter.
 */
#include "misc.h"
#include "app.h"
#include "board.h"

volatile uint32_t g_ms;

void timebase_init(void)
{
    RCC->APB1ENR |= RCC_APB1ENR_TIM7;
    /* TIM7 runs from PCLK1 (CPU / 4): 1 MHz count, reload every 1000 counts */
    TIM7->PSC = (uint32_t)(CFG_CPU_HZ / 4UL / 1000000UL) - 1U;
    TIM7->ARR = 1000U - 1U;
    TIM7->DIER = TIM_DIER_UIE;
    TIM7->CR1 = TIM_CR1_CEN;
    NVIC_SetPriority(TIM7_IRQn, IRQ_PRIO_TIMEBASE);
    NVIC_EnableIRQ(TIM7_IRQn);
}

uint32_t timebase_ms(void)
{
    return g_ms;
}

void TIM7_IRQHandler(void)
{
    static uint16_t sub;
    int woken = pdFALSE;

    TIM7->SR = 0U;
    g_ms++;
    if (++sub >= 1000U) {
        sub = 0;
        enum app_event ev = EV_SECOND;
        if (rtos_is_running()) {
            (void)queue_send_from_isr(g_event_q, &ev, &woken);
        }
    }
    port_yield_from_isr(woken);
}

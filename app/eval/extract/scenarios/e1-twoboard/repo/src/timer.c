/*
 * timer.c - system tick
 */
#include "timer.h"

volatile uint32_t g_ticks;

void timer_init(void)
{
    SysTick->LOAD = (CFG_CPU_HZ / CFG_TICK_HZ) - 1U;
    SysTick->VAL = 0U;
    SysTick->CTRL = SysTick_CTRL_CLKSOURCE | SysTick_CTRL_TICKINT | SysTick_CTRL_ENABLE;
}

uint32_t timer_now(void)
{
    return g_ticks;
}

void SysTick_Handler(void)
{
    g_ticks++;
}

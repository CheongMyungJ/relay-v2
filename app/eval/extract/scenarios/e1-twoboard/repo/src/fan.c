/*
 * fan.c - fan control (BETA board)
 *
 * TIM3 channel 1 captures the tachometer; the fan gives two pulses per revolution.
 * The PWM duty is written to the TIM3 compare register.
 */
#include "fan.h"
#include "board.h"
#include "timer.h"

volatile uint16_t g_fan_rpm;
static volatile uint16_t s_tach_pulses;
static uint32_t s_last_poll;

void fan_init(void)
{
    RCC->APB1ENR |= RCC_APB1ENR_TIM3;
    TIM3->PSC = (uint32_t)(CFG_CPU_HZ / 1000000UL) - 1U;   /* 1 MHz timer clock */
    TIM3->ARR = 999U;                                        /* 1 kHz PWM */
    TIM3->DIER = TIM_DIER_CC1IE;
    TIM3->CR1 = TIM_CR1_CEN;
    NVIC_SetPriority(TIM3_IRQn, 2U);
    NVIC_EnableIRQ(TIM3_IRQn);
    s_last_poll = timer_now();
}

void fan_set_duty(uint8_t percent)
{
    TIM3->CCR1 = (uint32_t)percent * 10U;
}

void fan_poll(void)
{
    if ((timer_now() - s_last_poll) < CFG_TICK_HZ) {
        return;
    }
    s_last_poll = timer_now();
    g_fan_rpm = (uint16_t)(s_tach_pulses * 30U);    /* pulses in one second / 2 * 60 */
    s_tach_pulses = 0U;
}

void TIM3_IRQHandler(void)
{
    if (TIM3->SR & TIM_SR_CC1IF) {
        TIM3->SR = ~TIM_SR_CC1IF;
        s_tach_pulses++;
    }
}

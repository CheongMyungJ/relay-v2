/*
 * nimbus_hal_tim.c - Nimbus N4 HAL: timer PWM and capture, CRC unit, RNG
 *
 * Copyright (c) 2017 Nimbus Semiconductor Ltd.
 * Distributed under the Nimbus Device Software License v2. Do not modify.
 *
 * Pass the timer kernel clock, not the bus clock: see the N4 reference manual,
 * section 6.2 (clock tree), for how the timer clock relates to the APB prescaler.
 */
#include "nimbus_n4_periph.h"

static volatile uint32_t *ccr(TIM_Type *tim, uint8_t channel)
{
    switch (channel) {
    case 1:
        return &tim->CCR1;
    case 2:
        return &tim->CCR2;
    case 3:
        return &tim->CCR3;
    default:
        return &tim->CCR4;
    }
}

void hal_tim_pwm_init(TIM_Type *tim, uint32_t timer_clk_hz, uint32_t pwm_hz, uint8_t channel)
{
    uint32_t psc = 0;
    uint32_t arr = timer_clk_hz / pwm_hz;
    while (arr > 0xFFFFUL) {
        psc++;
        arr = timer_clk_hz / ((psc + 1UL) * pwm_hz);
    }
    tim->CR1 = 0;
    tim->PSC = psc;
    tim->ARR = arr - 1UL;
    switch (channel) {
    case 1:
        tim->CCMR1 = (tim->CCMR1 & ~0x00FFUL) | TIM_CCMR1_OC1M_PWM1 | TIM_CCMR1_OC1PE;
        tim->CCER |= TIM_CCER_CC1E;
        break;
    case 2:
        tim->CCMR1 = (tim->CCMR1 & ~0xFF00UL) | TIM_CCMR1_OC2M_PWM1 | TIM_CCMR1_OC2PE;
        tim->CCER |= TIM_CCER_CC2E;
        break;
    case 3:
        tim->CCMR2 = (tim->CCMR2 & ~0x00FFUL) | TIM_CCMR2_OC3M_PWM1 | TIM_CCMR2_OC3PE;
        tim->CCER |= TIM_CCER_CC3E;
        break;
    default:
        tim->CCMR2 = (tim->CCMR2 & ~0xFF00UL) | TIM_CCMR2_OC4M_PWM1 | TIM_CCMR2_OC4PE;
        tim->CCER |= TIM_CCER_CC4E;
        break;
    }
    *ccr(tim, channel) = 0;
    tim->EGR = TIM_EGR_UG;
    tim->CR1 = TIM_CR1_ARPE | TIM_CR1_CEN_GP;
}

void hal_tim_pwm_set(TIM_Type *tim, uint8_t channel, uint16_t permille)
{
    if (permille > 1000U) {
        permille = 1000U;
    }
    *ccr(tim, channel) = ((tim->ARR + 1UL) * permille) / 1000UL;
}

void hal_tim_capture_init(TIM_Type *tim, uint32_t timer_clk_hz, uint32_t count_hz, uint8_t channel)
{
    tim->CR1 = 0;
    tim->PSC = (timer_clk_hz / count_hz) - 1UL;
    tim->ARR = 0xFFFFFFFFUL;
    if (channel == 1U) {
        tim->CCMR1 = (tim->CCMR1 & ~0x00FFUL) | TIM_CCMR1_CC1S_INPUT_TI1;
        tim->CCER |= TIM_CCER_CC1E;
        tim->DIER |= TIM_DIER_CC1IE;
    } else {
        tim->CCMR1 = (tim->CCMR1 & ~0xFF00UL) | TIM_CCMR1_CC2S_INPUT_TI2;
        tim->CCER |= TIM_CCER_CC2E;
        tim->DIER |= TIM_DIER_CC2IE;
    }
    tim->EGR = TIM_EGR_UG;
    tim->CR1 = TIM_CR1_CEN_GP;
}

uint32_t hal_crc32(const uint32_t *words, uint32_t count)
{
    CRC_UNIT->CR = CRC_CR_RESET;
    for (uint32_t i = 0; i < count; i++) {
        CRC_UNIT->DR = words[i];
    }
    return CRC_UNIT->DR;
}

int hal_rng_read(uint32_t *out)
{
    RNG->CR |= RNG_CR_RNGEN;
    for (uint32_t tries = 0; tries < 1000UL; tries++) {
        uint32_t sr = RNG->SR;
        if (sr & (RNG_SR_CECS | RNG_SR_SECS)) {
            return -1;
        }
        if (sr & RNG_SR_DRDY) {
            *out = RNG->DR;
            return 0;
        }
    }
    return -1;
}

/*
 * system_n4.c - Nimbus N4 clock setup
 *
 * Copyright (c) 2017 Nimbus Semiconductor Ltd.
 * Distributed under the Nimbus Device Software License v2. Do not modify.
 *
 * The application defines CFG_CPU_HZ (84 MHz or 168 MHz supported). HSE is the
 * 8 MHz crystal of the reference design. APB1 runs at CPU/4, APB2 at CPU/2.
 */
#include "nimbus_n4.h"

#ifndef HSE_HZ
#define HSE_HZ          8000000UL
#endif

#ifndef CFG_CPU_HZ
#error "CFG_CPU_HZ must be defined by the application configuration"
#endif

#define PLL_M           (HSE_HZ / 1000000UL)            /* 1 MHz VCO input */
#define PLL_P           2UL
#define PLL_N           ((CFG_CPU_HZ / 1000000UL) * PLL_P)
#define PLL_Q           7UL

uint32_t SystemCoreClock = CFG_CPU_HZ;

void SystemInit(void)
{
    RCC->CR |= RCC_CR_HSEON;
    while ((RCC->CR & RCC_CR_HSERDY) == 0U) {
    }
    RCC->PLLCFGR = PLL_M | (PLL_N << 6) | (((PLL_P / 2UL) - 1UL) << 16) | (1UL << 22) | (PLL_Q << 24);
    RCC->CR |= RCC_CR_PLLON;
    while ((RCC->CR & RCC_CR_PLLRDY) == 0U) {
    }
    /* flash wait states: one per 30 MHz */
    FLASH->ACR = (uint32_t)(CFG_CPU_HZ / 30000000UL) | (1UL << 8) | (1UL << 9) | (1UL << 10);
    RCC->CFGR = RCC_CFGR_PPRE1_DIV4 | RCC_CFGR_PPRE2_DIV2 | RCC_CFGR_SW_PLL;
    while ((RCC->CFGR & RCC_CFGR_SWS_MASK) != RCC_CFGR_SWS_PLL) {
    }
    SystemCoreClock = CFG_CPU_HZ;
}

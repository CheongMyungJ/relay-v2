/*
 * system_acme.c - Acme M3 system clock setup
 *
 * Copyright (c) 2014 Acme Microsystems Inc. All rights reserved.
 * Licensed under the Acme Software License Agreement v1.2.
 */
#include "acme_m3.h"
#include "build_cfg.h"

#ifndef HSE_VALUE
#define HSE_VALUE   8000000UL   /* external crystal on Acme reference boards */
#endif

#define PLL_MUL     (CFG_CPU_HZ / HSE_VALUE)

uint32_t SystemCoreClock = CFG_CPU_HZ;

void SystemInit(void)
{
    RCC->CR |= RCC_CR_HSEON;
    while ((RCC->CR & RCC_CR_HSERDY) == 0U) {
    }

    /* PLL input = HSE, multiplier encoded as (mul - 2) */
    RCC->CFGR = RCC_CFGR_PLLSRC_HSE | ((PLL_MUL - 2U) << RCC_CFGR_PLLMUL_POS);
    RCC->CR |= RCC_CR_PLLON;
    while ((RCC->CR & RCC_CR_PLLRDY) == 0U) {
    }

    /* two flash wait states above 48 MHz */
    FLASH->ACR = (CFG_CPU_HZ > 48000000UL) ? 2U : 1U;

    RCC->CFGR |= RCC_CFGR_SW_PLL;
    while ((RCC->CFGR & RCC_CFGR_SWS_PLL) != RCC_CFGR_SWS_PLL) {
    }
    SystemCoreClock = CFG_CPU_HZ;
}

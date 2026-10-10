/*
 * acme_m3.h - Acme M3 microcontroller peripheral access layer
 *
 * Copyright (c) 2014 Acme Microsystems Inc. All rights reserved.
 * Licensed under the Acme Software License Agreement v1.2.
 * Redistribution of this file is permitted only together with Acme devices.
 */
#ifndef ACME_M3_H
#define ACME_M3_H

#include <stdint.h>

#define __IO volatile

/* ---- Core: SysTick ---- */
typedef struct {
    __IO uint32_t CTRL;
    __IO uint32_t LOAD;
    __IO uint32_t VAL;
    __IO uint32_t CALIB;
} SysTick_Type;

#define SysTick_BASE        0xE000E010UL
#define SysTick             ((SysTick_Type *)SysTick_BASE)
#define SysTick_CTRL_ENABLE     (1UL << 0)
#define SysTick_CTRL_TICKINT    (1UL << 1)
#define SysTick_CTRL_CLKSOURCE  (1UL << 2)

/* ---- Core: NVIC ---- */
typedef struct {
    __IO uint32_t ISER[8];
    uint32_t RESERVED0[24];
    __IO uint32_t ICER[8];
    uint32_t RESERVED1[24];
    __IO uint32_t ISPR[8];
    uint32_t RESERVED2[24];
    __IO uint32_t ICPR[8];
    uint32_t RESERVED3[56];
    __IO uint8_t  IP[240];
} NVIC_Type;

#define NVIC_BASE           0xE000E100UL
#define NVIC                ((NVIC_Type *)NVIC_BASE)

typedef enum {
    WWDG_IRQn    = 0,
    RTC_IRQn     = 3,
    FLASH_IRQn   = 4,
    ADC1_IRQn    = 18,
    TIM2_IRQn    = 28,
    TIM3_IRQn    = 29,
    I2C1_IRQn    = 31,
    USART1_IRQn  = 37,
    USART2_IRQn  = 38
} IRQn_Type;

static inline void NVIC_EnableIRQ(IRQn_Type irq)
{
    NVIC->ISER[((uint32_t)irq) >> 5] = (1UL << (((uint32_t)irq) & 0x1FUL));
}

static inline void NVIC_SetPriority(IRQn_Type irq, uint32_t prio)
{
    NVIC->IP[(uint32_t)irq] = (uint8_t)((prio << 4) & 0xFFUL);
}

static inline void __disable_irq(void) { __asm volatile ("cpsid i" ::: "memory"); }
static inline void __enable_irq(void)  { __asm volatile ("cpsie i" ::: "memory"); }

/* ---- RCC ---- */
typedef struct {
    __IO uint32_t CR;
    __IO uint32_t CFGR;
    __IO uint32_t CIR;
    __IO uint32_t APB2RSTR;
    __IO uint32_t APB1RSTR;
    __IO uint32_t AHBENR;
    __IO uint32_t APB2ENR;
    __IO uint32_t APB1ENR;
    __IO uint32_t BDCR;
    __IO uint32_t CSR;
} RCC_Type;

#define RCC_BASE            0x40021000UL
#define RCC                 ((RCC_Type *)RCC_BASE)
#define RCC_CR_HSEON        (1UL << 16)
#define RCC_CR_HSERDY       (1UL << 17)
#define RCC_CR_PLLON        (1UL << 24)
#define RCC_CR_PLLRDY       (1UL << 25)
#define RCC_CFGR_SW_PLL     (2UL << 0)
#define RCC_CFGR_SWS_PLL    (2UL << 2)
#define RCC_CFGR_PLLSRC_HSE (1UL << 16)
#define RCC_CFGR_PLLMUL_POS 18U
#define RCC_CSR_LSION       (1UL << 0)
#define RCC_CSR_LSIRDY      (1UL << 1)
#define RCC_APB2ENR_GPIOA   (1UL << 2)
#define RCC_APB2ENR_GPIOB   (1UL << 3)
#define RCC_APB2ENR_ADC1    (1UL << 9)
#define RCC_APB2ENR_USART1  (1UL << 14)
#define RCC_APB1ENR_TIM3    (1UL << 1)

/* ---- GPIO ---- */
typedef struct {
    __IO uint32_t CRL;
    __IO uint32_t CRH;
    __IO uint32_t IDR;
    __IO uint32_t ODR;
    __IO uint32_t BSRR;
    __IO uint32_t BRR;
    __IO uint32_t LCKR;
} GPIO_Type;

#define GPIOA               ((GPIO_Type *)0x40010800UL)
#define GPIOB               ((GPIO_Type *)0x40010C00UL)

/* ---- USART ---- */
typedef struct {
    __IO uint32_t SR;
    __IO uint32_t DR;
    __IO uint32_t BRR;
    __IO uint32_t CR1;
    __IO uint32_t CR2;
    __IO uint32_t CR3;
    __IO uint32_t GTPR;
} USART_Type;

#define USART1              ((USART_Type *)0x40013800UL)
#define USART_SR_ORE        (1UL << 3)
#define USART_SR_RXNE       (1UL << 5)
#define USART_SR_TC         (1UL << 6)
#define USART_SR_TXE        (1UL << 7)
#define USART_CR1_RE        (1UL << 2)
#define USART_CR1_TE        (1UL << 3)
#define USART_CR1_RXNEIE    (1UL << 5)
#define USART_CR1_UE        (1UL << 13)

/* ---- ADC ---- */
typedef struct {
    __IO uint32_t SR;
    __IO uint32_t CR1;
    __IO uint32_t CR2;
    __IO uint32_t SMPR1;
    __IO uint32_t SMPR2;
    uint32_t RESERVED[6];
    __IO uint32_t SQR1;
    __IO uint32_t SQR2;
    __IO uint32_t SQR3;
    uint32_t RESERVED2[4];
    __IO uint32_t DR;
} ADC_Type;

#define ADC1                ((ADC_Type *)0x40012400UL)
#define ADC_SR_EOC          (1UL << 1)
#define ADC_CR1_EOCIE       (1UL << 5)
#define ADC_CR2_ADON        (1UL << 0)
#define ADC_CR2_CONT        (1UL << 1)
#define ADC_CR2_SWSTART     (1UL << 22)

/* ---- TIM (general purpose) ---- */
typedef struct {
    __IO uint32_t CR1;
    __IO uint32_t CR2;
    __IO uint32_t SMCR;
    __IO uint32_t DIER;
    __IO uint32_t SR;
    __IO uint32_t EGR;
    __IO uint32_t CCMR1;
    __IO uint32_t CCMR2;
    __IO uint32_t CCER;
    __IO uint32_t CNT;
    __IO uint32_t PSC;
    __IO uint32_t ARR;
    uint32_t RESERVED;
    __IO uint32_t CCR1;
} TIM_Type;

#define TIM3                ((TIM_Type *)0x40000400UL)
#define TIM_CR1_CEN         (1UL << 0)
#define TIM_DIER_CC1IE      (1UL << 1)
#define TIM_SR_CC1IF        (1UL << 1)

/* ---- IWDG (independent watchdog, clocked from LSI) ---- */
typedef struct {
    __IO uint32_t KR;
    __IO uint32_t PR;
    __IO uint32_t RLR;
    __IO uint32_t SR;
} IWDG_Type;

#define IWDG                ((IWDG_Type *)0x40003000UL)
#define IWDG_KEY_RELOAD     0xAAAAU
#define IWDG_KEY_ENABLE     0xCCCCU
#define IWDG_KEY_ACCESS     0x5555U
#define IWDG_PR_DIV4        0U
#define IWDG_PR_DIV8        1U
#define IWDG_PR_DIV16       2U
#define IWDG_PR_DIV32       3U
#define IWDG_PR_DIV64       4U
#define IWDG_PR_DIV128      5U
#define IWDG_PR_DIV256      6U

/* ---- FLASH (used for EEPROM emulation) ---- */
typedef struct {
    __IO uint32_t ACR;
    __IO uint32_t KEYR;
    __IO uint32_t OPTKEYR;
    __IO uint32_t SR;
    __IO uint32_t CR;
    __IO uint32_t AR;
} FLASH_Type;

#define FLASH               ((FLASH_Type *)0x40022000UL)
#define FLASH_SR_BSY        (1UL << 0)
#define FLASH_SR_PGERR      (1UL << 2)
#define FLASH_SR_EOP        (1UL << 5)
#define FLASH_CR_PG         (1UL << 0)
#define FLASH_CR_PER        (1UL << 1)
#define FLASH_CR_STRT       (1UL << 6)
#define FLASH_CR_LOCK       (1UL << 7)
#define FLASH_KEY1          0x45670123UL
#define FLASH_KEY2          0xCDEF89ABUL

void SystemInit(void);
extern uint32_t SystemCoreClock;

#endif /* ACME_M3_H */

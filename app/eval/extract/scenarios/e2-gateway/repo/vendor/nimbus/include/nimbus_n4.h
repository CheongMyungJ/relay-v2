/*
 * nimbus_n4.h - Nimbus N4 (Cortex-M4) device header
 *
 * Copyright (c) 2017 Nimbus Semiconductor Ltd.
 * Distributed under the Nimbus Device Software License v2. Do not modify.
 */
#ifndef NIMBUS_N4_H
#define NIMBUS_N4_H

#include <stdint.h>

#define __IO    volatile
#define __I     volatile const

/* ------------------------------------------------------------------ */
/* Interrupt numbers                                                   */
/* ------------------------------------------------------------------ */
typedef enum {
    WWDG_IRQn           = 0,
    PVD_IRQn            = 1,
    RTC_WKUP_IRQn       = 3,
    FLASH_IRQn          = 4,
    RCC_IRQn            = 5,
    EXTI0_IRQn          = 6,
    DMA1_Stream5_IRQn   = 16,
    DMA1_Stream6_IRQn   = 17,
    ADC_IRQn            = 18,
    CAN1_RX0_IRQn       = 20,
    TIM2_IRQn           = 28,
    TIM3_IRQn           = 29,
    SPI1_IRQn           = 35,
    USART1_IRQn         = 37,
    USART2_IRQn         = 38,
    TIM6_IRQn           = 54,
    TIM7_IRQn           = 55,
    DMA2_Stream0_IRQn   = 56,
    DMA2_Stream3_IRQn   = 59
} IRQn_Type;

#define NVIC_PRIO_BITS      4U

/* ------------------------------------------------------------------ */
/* Core peripherals                                                    */
/* ------------------------------------------------------------------ */
typedef struct {
    __IO uint32_t ISER[8];
    uint32_t RESERVED0[24];
    __IO uint32_t ICER[8];
    uint32_t RESERVED1[24];
    __IO uint32_t ISPR[8];
    uint32_t RESERVED2[24];
    __IO uint32_t ICPR[8];
    uint32_t RESERVED3[24];
    __IO uint32_t IABR[8];
    uint32_t RESERVED4[56];
    __IO uint8_t  IP[240];
} NVIC_Type;

#define NVIC    ((NVIC_Type *)0xE000E100UL)

typedef struct {
    __I  uint32_t CPUID;
    __IO uint32_t ICSR;
    __IO uint32_t VTOR;
    __IO uint32_t AIRCR;
    __IO uint32_t SCR;
    __IO uint32_t CCR;
    __IO uint8_t  SHP[12];
    __IO uint32_t SHCSR;
} SCB_Type;

#define SCB     ((SCB_Type *)0xE000ED00UL)
#define SCB_SCR_SLEEPDEEP   (1UL << 2)

static inline void NVIC_EnableIRQ(IRQn_Type irq)
{
    NVIC->ISER[(uint32_t)irq >> 5] = 1UL << ((uint32_t)irq & 0x1FUL);
}

static inline void NVIC_DisableIRQ(IRQn_Type irq)
{
    NVIC->ICER[(uint32_t)irq >> 5] = 1UL << ((uint32_t)irq & 0x1FUL);
}

/* prio is the 4-bit priority value; 0 is the most urgent */
static inline void NVIC_SetPriority(IRQn_Type irq, uint32_t prio)
{
    NVIC->IP[(uint32_t)irq] = (uint8_t)((prio << (8U - NVIC_PRIO_BITS)) & 0xFFUL);
}

static inline void __disable_irq(void) { __asm volatile ("cpsid i" ::: "memory"); }
static inline void __enable_irq(void)  { __asm volatile ("cpsie i" ::: "memory"); }
static inline void __WFI(void)         { __asm volatile ("wfi"); }
static inline void __NOP(void)         { __asm volatile ("nop"); }
static inline void __DSB(void)         { __asm volatile ("dsb" ::: "memory"); }

/* ------------------------------------------------------------------ */
/* RCC                                                                 */
/* ------------------------------------------------------------------ */
typedef struct {
    __IO uint32_t CR;
    __IO uint32_t PLLCFGR;
    __IO uint32_t CFGR;
    __IO uint32_t CIR;
    __IO uint32_t AHB1RSTR;
    __IO uint32_t AHB2RSTR;
    uint32_t RESERVED0[2];
    __IO uint32_t APB1RSTR;
    __IO uint32_t APB2RSTR;
    uint32_t RESERVED1[2];
    __IO uint32_t AHB1ENR;
    __IO uint32_t AHB2ENR;
    uint32_t RESERVED2[2];
    __IO uint32_t APB1ENR;
    __IO uint32_t APB2ENR;
    uint32_t RESERVED3[10];
    __IO uint32_t CSR;
} RCC_Type;

#define RCC     ((RCC_Type *)0x40023800UL)

#define RCC_CR_HSEON            (1UL << 16)
#define RCC_CR_HSERDY           (1UL << 17)
#define RCC_CR_PLLON            (1UL << 24)
#define RCC_CR_PLLRDY           (1UL << 25)
#define RCC_CFGR_SW_PLL         (2UL << 0)
#define RCC_CFGR_SWS_MASK       (3UL << 2)
#define RCC_CFGR_SWS_PLL        (2UL << 2)
#define RCC_CFGR_PPRE1_DIV2     (4UL << 10)
#define RCC_CFGR_PPRE1_DIV4     (5UL << 10)
#define RCC_CFGR_PPRE2_DIV2     (4UL << 13)
#define RCC_AHB1ENR_GPIOA       (1UL << 0)
#define RCC_AHB1ENR_GPIOB       (1UL << 1)
#define RCC_AHB1ENR_GPIOC       (1UL << 2)
#define RCC_AHB1ENR_DMA1        (1UL << 21)
#define RCC_AHB1ENR_DMA2        (1UL << 22)
#define RCC_APB1ENR_TIM6        (1UL << 4)
#define RCC_APB1ENR_TIM7        (1UL << 5)
#define RCC_APB1ENR_USART2      (1UL << 17)
#define RCC_APB2ENR_ADC1        (1UL << 8)
#define RCC_APB2ENR_SPI1        (1UL << 12)
#define RCC_CSR_LSION           (1UL << 0)
#define RCC_CSR_LSIRDY          (1UL << 1)
#define RCC_CSR_IWDGRSTF        (1UL << 29)
#define RCC_CSR_RMVF            (1UL << 24)

/* ------------------------------------------------------------------ */
/* GPIO                                                                */
/* ------------------------------------------------------------------ */
typedef struct {
    __IO uint32_t MODER;
    __IO uint32_t OTYPER;
    __IO uint32_t OSPEEDR;
    __IO uint32_t PUPDR;
    __IO uint32_t IDR;
    __IO uint32_t ODR;
    __IO uint32_t BSRR;
    __IO uint32_t LCKR;
    __IO uint32_t AFR[2];
} GPIO_Type;

#define GPIOA   ((GPIO_Type *)0x40020000UL)
#define GPIOB   ((GPIO_Type *)0x40020400UL)
#define GPIOC   ((GPIO_Type *)0x40020800UL)

/* ------------------------------------------------------------------ */
/* USART                                                               */
/* ------------------------------------------------------------------ */
typedef struct {
    __IO uint32_t SR;
    __IO uint32_t DR;
    __IO uint32_t BRR;
    __IO uint32_t CR1;
    __IO uint32_t CR2;
    __IO uint32_t CR3;
    __IO uint32_t GTPR;
} USART_Type;

#define USART1  ((USART_Type *)0x40011000UL)
#define USART2  ((USART_Type *)0x40004400UL)

#define USART_SR_PE         (1UL << 0)
#define USART_SR_FE         (1UL << 1)
#define USART_SR_NE         (1UL << 2)
#define USART_SR_ORE        (1UL << 3)
#define USART_SR_IDLE       (1UL << 4)
#define USART_SR_RXNE       (1UL << 5)
#define USART_SR_TC         (1UL << 6)
#define USART_SR_TXE        (1UL << 7)
#define USART_CR1_RE        (1UL << 2)
#define USART_CR1_TE        (1UL << 3)
#define USART_CR1_IDLEIE    (1UL << 4)
#define USART_CR1_RXNEIE    (1UL << 5)
#define USART_CR1_TCIE      (1UL << 6)
#define USART_CR1_PCE       (1UL << 10)
#define USART_CR1_M         (1UL << 12)
#define USART_CR1_UE        (1UL << 13)
#define USART_CR2_STOP_2    (2UL << 12)
#define USART_CR3_DMAR      (1UL << 6)
#define USART_CR3_DMAT      (1UL << 7)

/* ------------------------------------------------------------------ */
/* DMA                                                                 */
/* ------------------------------------------------------------------ */
typedef struct {
    __IO uint32_t CR;
    __IO uint32_t NDTR;
    __IO uint32_t PAR;
    __IO uint32_t M0AR;
    __IO uint32_t M1AR;
    __IO uint32_t FCR;
} DMA_Stream_Type;

typedef struct {
    __IO uint32_t LISR;
    __IO uint32_t HISR;
    __IO uint32_t LIFCR;
    __IO uint32_t HIFCR;
} DMA_Type;

#define DMA1            ((DMA_Type *)0x40026000UL)
#define DMA2            ((DMA_Type *)0x40026400UL)
#define DMA1_Stream5    ((DMA_Stream_Type *)0x40026088UL)
#define DMA1_Stream6    ((DMA_Stream_Type *)0x400260A0UL)
#define DMA2_Stream0    ((DMA_Stream_Type *)0x40026410UL)
#define DMA2_Stream3    ((DMA_Stream_Type *)0x40026458UL)

#define DMA_CR_EN           (1UL << 0)
#define DMA_CR_TCIE         (1UL << 4)
#define DMA_CR_HTIE         (1UL << 3)
#define DMA_CR_TEIE         (1UL << 2)
#define DMA_CR_DIR_P2M      (0UL << 6)
#define DMA_CR_DIR_M2P      (1UL << 6)
#define DMA_CR_CIRC         (1UL << 8)
#define DMA_CR_MINC         (1UL << 10)
#define DMA_CR_PSIZE_16     (1UL << 11)
#define DMA_CR_MSIZE_16     (1UL << 13)
#define DMA_CR_CHSEL(n)     ((uint32_t)(n) << 25)

/* ------------------------------------------------------------------ */
/* ADC                                                                 */
/* ------------------------------------------------------------------ */
typedef struct {
    __IO uint32_t SR;
    __IO uint32_t CR1;
    __IO uint32_t CR2;
    __IO uint32_t SMPR1;
    __IO uint32_t SMPR2;
    uint32_t RESERVED0[6];
    __IO uint32_t SQR1;
    __IO uint32_t SQR2;
    __IO uint32_t SQR3;
    uint32_t RESERVED1[5];
    __IO uint32_t DR;
} ADC_Type;

#define ADC1                ((ADC_Type *)0x40012000UL)
#define ADC_CR1_SCAN        (1UL << 8)
#define ADC_CR2_ADON        (1UL << 0)
#define ADC_CR2_CONT        (1UL << 1)
#define ADC_CR2_DMA         (1UL << 8)
#define ADC_CR2_DDS         (1UL << 9)
#define ADC_CR2_SWSTART     (1UL << 30)

/* ------------------------------------------------------------------ */
/* Basic timers                                                        */
/* ------------------------------------------------------------------ */
typedef struct {
    __IO uint32_t CR1;
    __IO uint32_t CR2;
    uint32_t RESERVED0;
    __IO uint32_t DIER;
    __IO uint32_t SR;
    __IO uint32_t EGR;
    uint32_t RESERVED1[3];
    __IO uint32_t CNT;
    __IO uint32_t PSC;
    __IO uint32_t ARR;
} TIM_Basic_Type;

#define TIM6                ((TIM_Basic_Type *)0x40001000UL)
#define TIM7                ((TIM_Basic_Type *)0x40001400UL)
#define TIM_CR1_CEN         (1UL << 0)
#define TIM_CR1_OPM         (1UL << 3)
#define TIM_DIER_UIE        (1UL << 0)
#define TIM_SR_UIF          (1UL << 0)

/* ------------------------------------------------------------------ */
/* SPI                                                                 */
/* ------------------------------------------------------------------ */
typedef struct {
    __IO uint32_t CR1;
    __IO uint32_t CR2;
    __IO uint32_t SR;
    __IO uint32_t DR;
} SPI_Type;

#define SPI1                ((SPI_Type *)0x40013000UL)
#define SPI_SR_RXNE         (1UL << 0)
#define SPI_SR_TXE          (1UL << 1)
#define SPI_SR_BSY          (1UL << 7)
#define SPI_CR1_MSTR        (1UL << 2)
#define SPI_CR1_SPE         (1UL << 6)
#define SPI_CR1_SSI         (1UL << 8)
#define SPI_CR1_SSM         (1UL << 9)

/* ------------------------------------------------------------------ */
/* FLASH                                                               */
/* ------------------------------------------------------------------ */
typedef struct {
    __IO uint32_t ACR;
    __IO uint32_t KEYR;
    __IO uint32_t OPTKEYR;
    __IO uint32_t SR;
    __IO uint32_t CR;
} FLASH_Type;

#define FLASH               ((FLASH_Type *)0x40023C00UL)
#define FLASH_SR_EOP        (1UL << 0)
#define FLASH_SR_PGSERR     (1UL << 7)
#define FLASH_SR_BSY        (1UL << 16)
#define FLASH_CR_PG         (1UL << 0)
#define FLASH_CR_SER        (1UL << 1)
#define FLASH_CR_SNB_POS    3U
#define FLASH_CR_PSIZE_32   (2UL << 8)
#define FLASH_CR_STRT       (1UL << 16)
#define FLASH_CR_LOCK       (1UL << 31)
#define FLASH_KEY1          0x45670123UL
#define FLASH_KEY2          0xCDEF89ABUL

/* ------------------------------------------------------------------ */
/* IWDG (clocked from the internal LSI oscillator)                     */
/* ------------------------------------------------------------------ */
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

void SystemInit(void);
extern uint32_t SystemCoreClock;

#endif /* NIMBUS_N4_H */

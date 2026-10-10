/*
 * nimbus_n4_periph.h - Nimbus N4 general purpose timers, PWR, CRC unit, RNG and DBGMCU
 *
 * Copyright (c) 2017 Nimbus Semiconductor Ltd.
 * Distributed under the Nimbus Device Software License v2. Do not modify.
 */
#ifndef NIMBUS_N4_PERIPH_H
#define NIMBUS_N4_PERIPH_H

#include <stdint.h>
#include "nimbus_n4.h"

/* ---- general purpose timers TIM2..TIM5 ---- */
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
    __IO uint32_t RCR;
    __IO uint32_t CCR1;
    __IO uint32_t CCR2;
    __IO uint32_t CCR3;
    __IO uint32_t CCR4;
    __IO uint32_t BDTR;
    __IO uint32_t DCR;
    __IO uint32_t DMAR;
    __IO uint32_t OR;
} TIM_Type;

#define TIM2                              ((TIM_Type *)0x40000000UL)
#define TIM3                              ((TIM_Type *)0x40000400UL)
#define TIM4                              ((TIM_Type *)0x40000800UL)
#define TIM5                              ((TIM_Type *)0x40000C00UL)

#define TIM_CR1_CEN_GP                    (1UL << 0)
#define TIM_CR1_UDIS                      (1UL << 1)
#define TIM_CR1_URS                       (1UL << 2)
#define TIM_CR1_OPM_GP                    (1UL << 3)
#define TIM_CR1_DIR                       (1UL << 4)
#define TIM_CR1_CMS_0                     (1UL << 5)
#define TIM_CR1_CMS_1                     (1UL << 6)
#define TIM_CR1_ARPE                      (1UL << 7)
#define TIM_CR1_CKD_0                     (1UL << 8)
#define TIM_CR1_CKD_1                     (1UL << 9)

#define TIM_DIER_UIE_GP                   (1UL << 0)
#define TIM_DIER_CC1IE                    (1UL << 1)
#define TIM_DIER_CC2IE                    (1UL << 2)
#define TIM_DIER_CC3IE                    (1UL << 3)
#define TIM_DIER_CC4IE                    (1UL << 4)
#define TIM_DIER_TIE                      (1UL << 6)
#define TIM_DIER_UDE                      (1UL << 8)
#define TIM_DIER_CC1DE                    (1UL << 9)
#define TIM_DIER_CC2DE                    (1UL << 10)
#define TIM_DIER_CC3DE                    (1UL << 11)
#define TIM_DIER_CC4DE                    (1UL << 12)
#define TIM_DIER_TDE                      (1UL << 14)

#define TIM_SR_UIF_GP                     (1UL << 0)
#define TIM_SR_CC1IF                      (1UL << 1)
#define TIM_SR_CC2IF                      (1UL << 2)
#define TIM_SR_CC3IF                      (1UL << 3)
#define TIM_SR_CC4IF                      (1UL << 4)
#define TIM_SR_TIF                        (1UL << 6)
#define TIM_SR_CC1OF                      (1UL << 9)
#define TIM_SR_CC2OF                      (1UL << 10)
#define TIM_SR_CC3OF                      (1UL << 11)
#define TIM_SR_CC4OF                      (1UL << 12)

#define TIM_EGR_UG                        (1UL << 0)
#define TIM_EGR_CC1G                      (1UL << 1)
#define TIM_EGR_CC2G                      (1UL << 2)
#define TIM_EGR_CC3G                      (1UL << 3)
#define TIM_EGR_CC4G                      (1UL << 4)
#define TIM_EGR_TG                        (1UL << 6)

#define TIM_CCER_CC1E                     (1UL << 0)
#define TIM_CCER_CC1P                     (1UL << 1)
#define TIM_CCER_CC1NP                    (1UL << 3)
#define TIM_CCER_CC2E                     (1UL << 4)
#define TIM_CCER_CC2P                     (1UL << 5)
#define TIM_CCER_CC2NP                    (1UL << 7)
#define TIM_CCER_CC3E                     (1UL << 8)
#define TIM_CCER_CC3P                     (1UL << 9)
#define TIM_CCER_CC3NP                    (1UL << 11)
#define TIM_CCER_CC4E                     (1UL << 12)
#define TIM_CCER_CC4P                     (1UL << 13)
#define TIM_CCER_CC4NP                    (1UL << 15)

#define TIM_CCMR1_OC1M_PWM1               (6UL << 4)
#define TIM_CCMR1_OC1M_PWM2               (7UL << 4)
#define TIM_CCMR1_OC1PE                   (1UL << 3)
#define TIM_CCMR1_CC1S_INPUT_TI1          (1UL << 0)
#define TIM_CCMR1_OC2M_PWM1               (6UL << 12)
#define TIM_CCMR1_OC2M_PWM2               (7UL << 12)
#define TIM_CCMR1_OC2PE                   (1UL << 11)
#define TIM_CCMR1_CC2S_INPUT_TI2          (1UL << 8)
#define TIM_CCMR2_OC3M_PWM1               (6UL << 4)
#define TIM_CCMR2_OC3PE                   (1UL << 3)
#define TIM_CCMR2_OC4M_PWM1               (6UL << 12)
#define TIM_CCMR2_OC4PE                   (1UL << 11)

/* ---- power control ---- */
typedef struct {
    __IO uint32_t CR;
    __IO uint32_t CSR;
} PWR_Type;

#define PWR                               ((PWR_Type *)0x40007000UL)
#define PWR_CR_LPDS                       (1UL << 0)
#define PWR_CR_PDDS                       (1UL << 1)
#define PWR_CR_CWUF                       (1UL << 2)
#define PWR_CR_CSBF                       (1UL << 3)
#define PWR_CR_PVDE                       (1UL << 4)
#define PWR_CR_PLS_0                      (1UL << 5)
#define PWR_CR_PLS_1                      (1UL << 6)
#define PWR_CR_PLS_2                      (1UL << 7)
#define PWR_CR_DBP                        (1UL << 8)
#define PWR_CR_FPDS                       (1UL << 9)
#define PWR_CR_VOS                        (1UL << 14)
#define PWR_CSR_WUF                       (1UL << 0)
#define PWR_CSR_SBF                       (1UL << 1)
#define PWR_CSR_PVDO                      (1UL << 2)
#define PWR_CSR_BRR                       (1UL << 3)
#define PWR_CSR_EWUP                      (1UL << 8)
#define PWR_CSR_BRE                       (1UL << 9)
#define PWR_CSR_VOSRDY                    (1UL << 14)

/* ---- CRC calculation unit (CRC-32/MPEG-2, 32-bit words only) ---- */
typedef struct {
    __IO uint32_t DR;
    __IO uint8_t  IDR;
    uint8_t RESERVED0;
    uint16_t RESERVED1;
    __IO uint32_t CR;
} CRC_Type;

#define CRC_UNIT                          ((CRC_Type *)0x40023000UL)
#define CRC_CR_RESET                      (1UL << 0)

/* ---- random number generator ---- */
typedef struct {
    __IO uint32_t CR;
    __IO uint32_t SR;
    __IO uint32_t DR;
} RNG_Type;

#define RNG                               ((RNG_Type *)0x50060800UL)
#define RNG_CR_RNGEN                      (1UL << 2)
#define RNG_CR_IE                         (1UL << 3)
#define RNG_SR_DRDY                       (1UL << 0)
#define RNG_SR_CECS                       (1UL << 1)
#define RNG_SR_SECS                       (1UL << 2)

/* ---- debug MCU: freeze peripherals while the core is halted ---- */
typedef struct {
    __IO uint32_t IDCODE;
    __IO uint32_t CR;
    __IO uint32_t APB1FZ;
    __IO uint32_t APB2FZ;
} DBGMCU_Type;

#define DBGMCU                            ((DBGMCU_Type *)0xE0042000UL)
#define DBGMCU_APB1_FZ_TIM2                     (1UL << 0)
#define DBGMCU_APB1_FZ_TIM3                     (1UL << 1)
#define DBGMCU_APB1_FZ_TIM4                     (1UL << 2)
#define DBGMCU_APB1_FZ_TIM5                     (1UL << 3)
#define DBGMCU_APB1_FZ_TIM6                     (1UL << 4)
#define DBGMCU_APB1_FZ_TIM7                     (1UL << 5)
#define DBGMCU_APB1_FZ_RTC                      (1UL << 10)
#define DBGMCU_APB1_FZ_WWDG                     (1UL << 11)
#define DBGMCU_APB1_FZ_IWDG                     (1UL << 12)
#define DBGMCU_APB1_FZ_I2C1_SMBUS_TIMEOUT       (1UL << 21)
#define DBGMCU_APB1_FZ_CAN1                     (1UL << 25)

void hal_tim_pwm_init(TIM_Type *tim, uint32_t timer_clk_hz, uint32_t pwm_hz, uint8_t channel);
void hal_tim_pwm_set(TIM_Type *tim, uint8_t channel, uint16_t permille);
void hal_tim_capture_init(TIM_Type *tim, uint32_t timer_clk_hz, uint32_t count_hz, uint8_t channel);
uint32_t hal_crc32(const uint32_t *words, uint32_t count);
int hal_rng_read(uint32_t *out);

#endif /* NIMBUS_N4_PERIPH_H */

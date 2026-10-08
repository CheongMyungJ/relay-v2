/*
 * startup_n4.c - Nimbus N4 startup code and vector table
 *
 * Copyright (c) 2017 Nimbus Semiconductor Ltd.
 * Distributed under the Nimbus Device Software License v2. Do not modify.
 *
 * Every handler is a weak alias of Default_Handler, which spins forever. An
 * interrupt that is enabled but has no handler in the application therefore hangs
 * the device until the watchdog resets it.
 */
#include <stdint.h>
#include "nimbus_n4.h"

extern uint32_t _estack;
extern uint32_t _sidata, _sdata, _edata, _sbss, _ebss;

int main(void);
void Reset_Handler(void);
void Default_Handler(void);

#define WEAK __attribute__((weak, alias("Default_Handler")))

void NMI_Handler(void) WEAK;
void HardFault_Handler(void) WEAK;
void MemManage_Handler(void) WEAK;
void BusFault_Handler(void) WEAK;
void UsageFault_Handler(void) WEAK;
void SVC_Handler(void) WEAK;
void DebugMon_Handler(void) WEAK;
void PendSV_Handler(void) WEAK;
void SysTick_Handler(void) WEAK;
void WWDG_IRQHandler(void) WEAK;
void PVD_IRQHandler(void) WEAK;
void RTC_WKUP_IRQHandler(void) WEAK;
void FLASH_IRQHandler(void) WEAK;
void RCC_IRQHandler(void) WEAK;
void EXTI0_IRQHandler(void) WEAK;
void DMA1_Stream5_IRQHandler(void) WEAK;
void DMA1_Stream6_IRQHandler(void) WEAK;
void ADC_IRQHandler(void) WEAK;
void CAN1_RX0_IRQHandler(void) WEAK;
void TIM2_IRQHandler(void) WEAK;
void TIM3_IRQHandler(void) WEAK;
void SPI1_IRQHandler(void) WEAK;
void USART1_IRQHandler(void) WEAK;
void USART2_IRQHandler(void) WEAK;
void TIM6_DAC_IRQHandler(void) WEAK;
void TIM7_IRQHandler(void) WEAK;
void DMA2_Stream0_IRQHandler(void) WEAK;
void DMA2_Stream3_IRQHandler(void) WEAK;

typedef void (*vector_t)(void);

__attribute__((section(".isr_vector"), used))
const vector_t g_vector_table[16 + 64] = {
    (vector_t)&_estack,
    Reset_Handler,
    NMI_Handler,
    HardFault_Handler,
    MemManage_Handler,
    BusFault_Handler,
    UsageFault_Handler,
    0, 0, 0, 0,
    SVC_Handler,
    DebugMon_Handler,
    0,
    PendSV_Handler,
    SysTick_Handler,
    [16 + WWDG_IRQn]          = WWDG_IRQHandler,
    [16 + PVD_IRQn]           = PVD_IRQHandler,
    [16 + RTC_WKUP_IRQn]      = RTC_WKUP_IRQHandler,
    [16 + FLASH_IRQn]         = FLASH_IRQHandler,
    [16 + RCC_IRQn]           = RCC_IRQHandler,
    [16 + EXTI0_IRQn]         = EXTI0_IRQHandler,
    [16 + DMA1_Stream5_IRQn]  = DMA1_Stream5_IRQHandler,
    [16 + DMA1_Stream6_IRQn]  = DMA1_Stream6_IRQHandler,
    [16 + ADC_IRQn]           = ADC_IRQHandler,
    [16 + CAN1_RX0_IRQn]      = CAN1_RX0_IRQHandler,
    [16 + TIM2_IRQn]          = TIM2_IRQHandler,
    [16 + TIM3_IRQn]          = TIM3_IRQHandler,
    [16 + SPI1_IRQn]          = SPI1_IRQHandler,
    [16 + USART1_IRQn]        = USART1_IRQHandler,
    [16 + USART2_IRQn]        = USART2_IRQHandler,
    [16 + TIM6_IRQn]          = TIM6_DAC_IRQHandler,
    [16 + TIM7_IRQn]          = TIM7_IRQHandler,
    [16 + DMA2_Stream0_IRQn]  = DMA2_Stream0_IRQHandler,
    [16 + DMA2_Stream3_IRQn]  = DMA2_Stream3_IRQHandler,
};

void Reset_Handler(void)
{
    uint32_t *src = &_sidata;
    for (uint32_t *dst = &_sdata; dst < &_edata; ) {
        *dst++ = *src++;
    }
    for (uint32_t *dst = &_sbss; dst < &_ebss; ) {
        *dst++ = 0U;
    }
    SystemInit();
    (void)main();
    for (;;) {
    }
}

void Default_Handler(void)
{
    for (;;) {
    }
}

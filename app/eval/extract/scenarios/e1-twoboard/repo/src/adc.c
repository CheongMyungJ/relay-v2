/*
 * adc.c - temperature sensor sampling
 *
 * The ADC converts continuously; every end-of-conversion interrupt stores the
 * sample and checks the over-temperature limit so the heater is cut even if the
 * main loop stalls.
 */
#include "adc.h"
#include "board.h"
#include "control.h"
#include "fault.h"

volatile uint16_t g_adc_raw;
volatile int16_t g_cal_offset;

void adc_init(void)
{
    RCC->APB2ENR |= RCC_APB2ENR_ADC1;
    ADC1->SMPR2 = 7U;               /* longest sample time on channel 0 */
    ADC1->SQR3 = 0U;                /* channel 0 (PA0) */
    ADC1->CR1 = ADC_CR1_EOCIE;
    ADC1->CR2 = ADC_CR2_ADON | ADC_CR2_CONT;
    ADC1->CR2 |= ADC_CR2_SWSTART;
    NVIC_SetPriority(ADC1_IRQn, 0U);
    NVIC_EnableIRQ(ADC1_IRQn);
}

/* TMP36 front end: 10 mV per degree, 500 mV at 0 C, 3.3 V reference, 12-bit ADC */
int16_t adc_to_dc(uint16_t raw)
{
    int32_t mv = ((int32_t)raw * 3300) / 4096;
    return (int16_t)(mv - 500);
}

void ADC1_IRQHandler(void)
{
    uint16_t raw = (uint16_t)ADC1->DR;     /* reading DR clears EOC */

    g_adc_raw = raw;
    if (raw == 0U || raw >= 4095U) {
        g_fault_flags |= FAULT_SENSOR;
        return;
    }
    if (adc_to_dc((uint16_t)(raw + g_cal_offset)) > OVERTEMP_DC) {
        GPIOB->BRR = (1UL << HEATER_PIN);
        g_fault_flags |= FAULT_OVERTEMP;
    }
}

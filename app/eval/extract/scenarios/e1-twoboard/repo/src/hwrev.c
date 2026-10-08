/*
 * hwrev.c - hardware revision straps
 *
 * Boards from revision C on use a different sensor divider; the ADC reading is
 * corrected by g_cal_offset.
 */
#include "hwrev.h"
#include "adc.h"
#include "board.h"
#include "timer.h"

uint8_t g_hw_rev;

void hwrev_init(void)
{
    RCC->APB2ENR |= RCC_APB2ENR_GPIOA;
    /* PA6, PA7 inputs with pull-up */
    GPIOA->CRL = (GPIOA->CRL & ~0xFF000000UL) | 0x88000000UL;
    GPIOA->ODR |= (1UL << HWREV_PIN0) | (1UL << HWREV_PIN1);
    delay_ms(2U);   /* let the pull-ups settle before sampling */

    g_hw_rev = (uint8_t)(((GPIOA->IDR >> HWREV_PIN0) & 1U) | (((GPIOA->IDR >> HWREV_PIN1) & 1U) << 1));
    g_cal_offset = (g_hw_rev >= 2U) ? -12 : 0;
}

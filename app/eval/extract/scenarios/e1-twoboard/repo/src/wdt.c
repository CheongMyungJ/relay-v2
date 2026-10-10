/*
 * wdt.c - independent watchdog
 *
 * LSI is about 40 kHz, so with /64 the counter runs at 625 Hz and a reload of 625
 * gives a timeout of about 1 s.
 */
#include "wdt.h"
#include "board.h"

#define WDT_PRESCALER   IWDG_PR_DIV64
#define WDT_RELOAD      625U

void wdt_init(void)
{
    RCC->CSR |= RCC_CSR_LSION;
    while ((RCC->CSR & RCC_CSR_LSIRDY) == 0U) {
    }
    IWDG->KR = IWDG_KEY_ACCESS;
    IWDG->PR = WDT_PRESCALER;
    IWDG->RLR = WDT_RELOAD;
    IWDG->KR = IWDG_KEY_RELOAD;
    IWDG->KR = IWDG_KEY_ENABLE;
}

void wdt_kick(void)
{
    IWDG->KR = IWDG_KEY_RELOAD;
}

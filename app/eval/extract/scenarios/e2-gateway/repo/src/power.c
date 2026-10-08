/*
 * power.c - low-power idle (pro)
 *
 * Replaces the kernel's weak idle hook: the CPU sleeps until the next interrupt when
 * no task is ready. DMA and peripherals keep running in sleep mode.
 */
#include "picortos.h"
#include "nimbus_n4.h"

void rtos_idle_hook(void)
{
#if CFG_LOW_POWER
    SCB->SCR &= ~SCB_SCR_SLEEPDEEP;
    __DSB();
    __WFI();
#endif
}

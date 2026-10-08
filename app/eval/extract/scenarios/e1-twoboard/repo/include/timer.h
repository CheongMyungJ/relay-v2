#ifndef TIMER_H
#define TIMER_H

#include <stdint.h>
#include "board.h"

/* system tick: SysTick interrupt every 1/CFG_TICK_HZ s */
extern volatile uint32_t g_ticks;

void timer_init(void);
uint32_t timer_now(void);
void delay_ms(uint32_t ms);

#endif /* TIMER_H */

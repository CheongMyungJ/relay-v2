/*
 * board.c - GW-400 board bring-up
 */
#include "board.h"

void board_init(void)
{
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOA | RCC_AHB1ENR_GPIOB | RCC_AHB1ENR_GPIOC;

    hal_gpio_mode(LED_PORT, LED_PIN, HAL_GPIO_OUTPUT);
    board_led(0);

    /* 4 bits of preemption priority, no sub-priority */
    SCB->AIRCR = (0x05FAUL << 16) | (3UL << 8);
}

void board_led(int on)
{
    /* the LED is wired to the supply: low turns it on */
    hal_gpio_write(LED_PORT, LED_PIN, !on);
}

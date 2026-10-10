/*
 * uart.c - USART1 driver (host link)
 *
 * Receive is interrupt driven into g_rx_ring. Transmit is polled.
 */
#include "uart.h"
#include "board.h"

ring_t g_rx_ring;
volatile uint16_t g_rx_overruns;

void uart_init(void)
{
    RCC->APB2ENR |= RCC_APB2ENR_GPIOA | RCC_APB2ENR_USART1;
    /* PA9 = TX (AF push-pull), PA10 = RX (floating input) */
    GPIOA->CRH = (GPIOA->CRH & ~0x00000FF0UL) | 0x000004B0UL;

    USART1->BRR = (uint32_t)(CFG_CPU_HZ / CFG_UART_BAUD);
    USART1->CR1 = USART_CR1_UE | USART_CR1_TE | USART_CR1_RE | USART_CR1_RXNEIE;

    NVIC_SetPriority(USART1_IRQn, 1U);
    NVIC_EnableIRQ(USART1_IRQn);
}

void uart_send(const uint8_t *data, uint8_t len)
{
    for (uint8_t i = 0; i < len; i++) {
        while ((USART1->SR & USART_SR_TXE) == 0U) {
        }
        USART1->DR = data[i];
    }
    while ((USART1->SR & USART_SR_TC) == 0U) {
    }
}

void USART1_IRQHandler(void)
{
    uint32_t sr = USART1->SR;

    if (sr & USART_SR_ORE) {
        (void)USART1->DR;   /* reading DR clears the overrun */
        g_rx_overruns++;
        return;
    }
    if (sr & USART_SR_RXNE) {
        uint8_t b = (uint8_t)USART1->DR;
        if (!ring_put(&g_rx_ring, b)) {
            g_rx_overruns++;
        }
    }
}

/*
 * rs485.c - RS-485 link on USART2 (half duplex, DMA in both directions)
 *
 * Receive: DMA1 stream 5 copies every byte into a circular buffer. End of frame is
 * detected with the t3.5 silent interval required by Modbus RTU: the USART idle-line
 * interrupt fires, the bytes since the previous frame are copied out and queued for
 * the comm task.
 *
 * Transmit: the comm task raises DE, waits for the transceiver, and starts DMA1
 * stream 6. The DMA transfer-complete interrupt drops DE and wakes the task.
 */
#include <string.h>
#include "rs485.h"
#include "board.h"
#include "stats.h"
#include "modbus.h"

/* transceiver enable-to-output time: about 10 us at 168 MHz */
#define DE_SETUP_LOOPS      420U

static const hal_dma_t s_rx_dma = { DMA1, DMA1_Stream5, 5U, 4U };
static const hal_dma_t s_tx_dma = { DMA1, DMA1_Stream6, 6U, 4U };

static uint8_t s_rx_buf[RS485_RX_DMA_SIZE];
static uint16_t s_rx_pos;               /* where the next frame starts in s_rx_buf */
static uint8_t s_tx_buf[MB_FRAME_MAX];
static sem_t s_tx_done;

queue_t g_mb_rx_q;

static void de_setup_delay(void)
{
    for (volatile uint32_t i = 0; i < DE_SETUP_LOOPS; i++) {
    }
}

void rs485_init(uint32_t baud)
{
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOA | RCC_AHB1ENR_DMA1;
    RCC->APB1ENR |= RCC_APB1ENR_USART2;

    hal_gpio_af(RS485_PORT, RS485_TX_PIN, RS485_AF);
    hal_gpio_af(RS485_PORT, RS485_RX_PIN, RS485_AF);
    hal_gpio_mode(RS485_PORT, RS485_DE_PIN, HAL_GPIO_OUTPUT);
    hal_gpio_write(RS485_PORT, RS485_DE_PIN, 0);

    hal_uart_init(RS485_UART, hal_rcc_pclk1(), baud,
                  CFG_MB_PARITY_EVEN ? HAL_UART_PARITY_EVEN : HAL_UART_PARITY_NONE,
                  (uint8_t)CFG_MB_STOP_BITS);
    hal_uart_enable_dma(RS485_UART, 1, 1);
    hal_uart_enable_idle_irq(RS485_UART);

    g_mb_rx_q = queue_create(4U, sizeof(mb_frame_t));
    s_tx_done = sem_create_binary();

    s_rx_pos = 0;
    hal_dma_start(&s_rx_dma, (uint32_t)&RS485_UART->DR, s_rx_buf, RS485_RX_DMA_SIZE,
                  HAL_DMA_P2M, 1, 0, 0);

    NVIC_SetPriority(USART2_IRQn, IRQ_PRIO_RS485);
    NVIC_SetPriority(DMA1_Stream6_IRQn, IRQ_PRIO_RS485_DMA);
    NVIC_EnableIRQ(USART2_IRQn);
    NVIC_EnableIRQ(DMA1_Stream6_IRQn);
}

/* idle line: a pause of one character time after at least one received byte */
void USART2_IRQHandler(void)
{
    static mb_frame_t frame;
    int woken = pdFALSE;
    uint32_t sr = hal_uart_clear_flags(RS485_UART);

    if (sr & USART_SR_ORE) {
        g_stats.rx_overruns++;
    }
    if ((sr & USART_SR_IDLE) == 0U) {
        return;
    }

    uint16_t head = (uint16_t)(RS485_RX_DMA_SIZE - hal_dma_remaining(&s_rx_dma));
    if (head == RS485_RX_DMA_SIZE) {
        head = 0;
    }
    uint16_t n = (uint16_t)((head + RS485_RX_DMA_SIZE - s_rx_pos) % RS485_RX_DMA_SIZE);
    if (n == 0U) {
        return;
    }
    for (uint16_t i = 0; i < n; i++) {
        frame.data[i] = s_rx_buf[(s_rx_pos + i) % RS485_RX_DMA_SIZE];
    }
    frame.len = n;
    s_rx_pos = head;

    g_stats.rx_frames++;
    g_stats.rx_bytes += n;
    if (queue_send_from_isr(g_mb_rx_q, &frame, &woken) != pdPASS) {
        g_stats.rx_overruns++;
    }
    port_yield_from_isr(woken);
}

/* transmit DMA finished: release the bus and wake the sender */
void DMA1_Stream6_IRQHandler(void)
{
    int woken = pdFALSE;
    uint32_t flags = hal_dma_flags(&s_tx_dma);

    hal_dma_clear(&s_tx_dma, flags);
    if (flags & HAL_DMA_FLAG_TC) {
        hal_gpio_write(RS485_PORT, RS485_DE_PIN, 0);
        sem_give_from_isr(s_tx_done, &woken);
    }
    port_yield_from_isr(woken);
}

int rs485_send(const uint8_t *data, uint16_t len)
{
    if (len > MB_FRAME_MAX) {
        return -1;
    }
    memcpy(s_tx_buf, data, len);
    hal_gpio_write(RS485_PORT, RS485_DE_PIN, 1);
    de_setup_delay();
    hal_dma_start(&s_tx_dma, (uint32_t)&RS485_UART->DR, s_tx_buf, len, HAL_DMA_M2P, 0, 0, 0);
    if (sem_take(s_tx_done, pdMS_TO_TICKS(MB_TX_TIMEOUT_MS)) != pdPASS) {
        hal_dma_stop(&s_tx_dma);
        hal_gpio_write(RS485_PORT, RS485_DE_PIN, 0);
        g_stats.tx_timeouts++;
        return -1;
    }
    return 0;
}

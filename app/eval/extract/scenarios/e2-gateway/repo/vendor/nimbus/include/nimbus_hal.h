/*
 * nimbus_hal.h - Nimbus N4 hardware abstraction layer
 *
 * Copyright (c) 2017 Nimbus Semiconductor Ltd.
 * Distributed under the Nimbus Device Software License v2. Do not modify.
 */
#ifndef NIMBUS_HAL_H
#define NIMBUS_HAL_H

#include <stdint.h>
#include "nimbus_n4.h"

/* ---- GPIO ---- */
#define HAL_GPIO_INPUT      0U
#define HAL_GPIO_OUTPUT     1U
#define HAL_GPIO_AF         2U
#define HAL_GPIO_ANALOG     3U
#define HAL_GPIO_PULLUP     1U
#define HAL_GPIO_PULLDOWN   2U

void hal_gpio_mode(GPIO_Type *port, uint8_t pin, uint8_t mode);
void hal_gpio_pull(GPIO_Type *port, uint8_t pin, uint8_t pull);
void hal_gpio_af(GPIO_Type *port, uint8_t pin, uint8_t af);

static inline void hal_gpio_write(GPIO_Type *port, uint8_t pin, int high)
{
    port->BSRR = high ? (1UL << pin) : (1UL << (pin + 16U));
}

static inline int hal_gpio_read(GPIO_Type *port, uint8_t pin)
{
    return (int)((port->IDR >> pin) & 1UL);
}

/* ---- USART ---- */
#define HAL_UART_PARITY_NONE    0U
#define HAL_UART_PARITY_EVEN    1U

void hal_uart_init(USART_Type *u, uint32_t pclk_hz, uint32_t baud, uint8_t parity, uint8_t stop_bits);
void hal_uart_enable_idle_irq(USART_Type *u);
void hal_uart_enable_dma(USART_Type *u, int rx, int tx);
uint32_t hal_uart_clear_flags(USART_Type *u);

/* ---- DMA ---- */
#define HAL_DMA_P2M         0U
#define HAL_DMA_M2P         1U

typedef struct {
    DMA_Type *dma;
    DMA_Stream_Type *stream;
    uint8_t stream_no;
    uint8_t channel;
} hal_dma_t;

void hal_dma_start(const hal_dma_t *d, uint32_t periph_addr, void *mem, uint16_t count,
                   uint8_t dir, int circular, int half_word, int irq_half);
void hal_dma_stop(const hal_dma_t *d);
uint16_t hal_dma_remaining(const hal_dma_t *d);
uint32_t hal_dma_flags(const hal_dma_t *d);
void hal_dma_clear(const hal_dma_t *d, uint32_t flags);

#define HAL_DMA_FLAG_TC     (1UL << 5)
#define HAL_DMA_FLAG_HT     (1UL << 4)
#define HAL_DMA_FLAG_TE     (1UL << 3)

/* ---- ADC ---- */
void hal_adc_init_scan(ADC_Type *adc, const uint8_t *channels, uint8_t count, uint8_t sample_time);
void hal_adc_start(ADC_Type *adc);

/* ---- FLASH ---- */
int hal_flash_unlock(void);
void hal_flash_lock(void);
int hal_flash_erase_sector(uint8_t sector);
int hal_flash_program_word(uint32_t addr, uint32_t word);

/* ---- SPI ---- */
void hal_spi_init(SPI_Type *spi, uint32_t pclk_hz, uint32_t max_hz);
uint8_t hal_spi_xfer(SPI_Type *spi, uint8_t out);

/* ---- clocks ---- */
uint32_t hal_rcc_pclk1(void);
uint32_t hal_rcc_pclk2(void);

#endif /* NIMBUS_HAL_H */

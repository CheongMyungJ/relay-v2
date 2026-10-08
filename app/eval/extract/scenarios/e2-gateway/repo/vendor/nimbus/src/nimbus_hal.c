/*
 * nimbus_hal.c - Nimbus N4 hardware abstraction layer
 *
 * Copyright (c) 2017 Nimbus Semiconductor Ltd.
 * Distributed under the Nimbus Device Software License v2. Do not modify.
 */
#include "nimbus_hal.h"

/* ------------------------------------------------------------------ */
/* GPIO                                                                */
/* ------------------------------------------------------------------ */
void hal_gpio_mode(GPIO_Type *port, uint8_t pin, uint8_t mode)
{
    port->MODER = (port->MODER & ~(3UL << (pin * 2U))) | ((uint32_t)mode << (pin * 2U));
}

void hal_gpio_pull(GPIO_Type *port, uint8_t pin, uint8_t pull)
{
    port->PUPDR = (port->PUPDR & ~(3UL << (pin * 2U))) | ((uint32_t)pull << (pin * 2U));
}

void hal_gpio_af(GPIO_Type *port, uint8_t pin, uint8_t af)
{
    uint32_t idx = pin >> 3;
    uint32_t shift = (pin & 7U) * 4U;
    port->AFR[idx] = (port->AFR[idx] & ~(0xFUL << shift)) | ((uint32_t)af << shift);
    hal_gpio_mode(port, pin, HAL_GPIO_AF);
}

/* ------------------------------------------------------------------ */
/* USART                                                               */
/* ------------------------------------------------------------------ */
void hal_uart_init(USART_Type *u, uint32_t pclk_hz, uint32_t baud, uint8_t parity, uint8_t stop_bits)
{
    u->CR1 = 0;
    /* oversampling by 16, rounded divider */
    u->BRR = (pclk_hz + baud / 2U) / baud;
    u->CR2 = (stop_bits == 2U) ? USART_CR2_STOP_2 : 0U;
    u->CR1 = USART_CR1_TE | USART_CR1_RE;
    if (parity == HAL_UART_PARITY_EVEN) {
        /* parity uses the ninth bit: 8 data bits + parity */
        u->CR1 |= USART_CR1_PCE | USART_CR1_M;
    }
    u->CR1 |= USART_CR1_UE;
}

void hal_uart_enable_idle_irq(USART_Type *u)
{
    u->CR1 |= USART_CR1_IDLEIE;
}

void hal_uart_enable_dma(USART_Type *u, int rx, int tx)
{
    uint32_t cr3 = u->CR3 & ~(USART_CR3_DMAR | USART_CR3_DMAT);
    if (rx) {
        cr3 |= USART_CR3_DMAR;
    }
    if (tx) {
        cr3 |= USART_CR3_DMAT;
    }
    u->CR3 = cr3;
}

/* Clears IDLE, ORE, NE, FE, PE by the SR-then-DR read sequence. Returns the SR seen. */
uint32_t hal_uart_clear_flags(USART_Type *u)
{
    uint32_t sr = u->SR;
    (void)u->DR;
    return sr;
}

/* ------------------------------------------------------------------ */
/* DMA                                                                 */
/* ------------------------------------------------------------------ */
static volatile uint32_t *dma_ifcr(const hal_dma_t *d)
{
    return (d->stream_no < 4U) ? &d->dma->LIFCR : &d->dma->HIFCR;
}

static uint32_t dma_shift(const hal_dma_t *d)
{
    static const uint8_t shift[4] = { 0U, 6U, 16U, 22U };
    return shift[d->stream_no & 3U];
}

void hal_dma_start(const hal_dma_t *d, uint32_t periph_addr, void *mem, uint16_t count,
                   uint8_t dir, int circular, int half_word, int irq_half)
{
    d->stream->CR &= ~DMA_CR_EN;
    while (d->stream->CR & DMA_CR_EN) {
    }
    *dma_ifcr(d) = 0x3DUL << dma_shift(d);
    d->stream->PAR = periph_addr;
    d->stream->M0AR = (uint32_t)mem;
    d->stream->NDTR = count;
    uint32_t cr = DMA_CR_CHSEL(d->channel) | DMA_CR_MINC | DMA_CR_TCIE | DMA_CR_TEIE;
    cr |= (dir == HAL_DMA_M2P) ? DMA_CR_DIR_M2P : DMA_CR_DIR_P2M;
    if (circular) {
        cr |= DMA_CR_CIRC;
    }
    if (half_word) {
        cr |= DMA_CR_PSIZE_16 | DMA_CR_MSIZE_16;
    }
    if (irq_half) {
        cr |= DMA_CR_HTIE;
    }
    d->stream->CR = cr;
    d->stream->CR |= DMA_CR_EN;
}

void hal_dma_stop(const hal_dma_t *d)
{
    d->stream->CR &= ~DMA_CR_EN;
    while (d->stream->CR & DMA_CR_EN) {
    }
}

uint16_t hal_dma_remaining(const hal_dma_t *d)
{
    return (uint16_t)d->stream->NDTR;
}

uint32_t hal_dma_flags(const hal_dma_t *d)
{
    uint32_t isr = (d->stream_no < 4U) ? d->dma->LISR : d->dma->HISR;
    return (isr >> dma_shift(d)) & 0x3DUL;
}

void hal_dma_clear(const hal_dma_t *d, uint32_t flags)
{
    *dma_ifcr(d) = (flags & 0x3DUL) << dma_shift(d);
}

/* ------------------------------------------------------------------ */
/* ADC                                                                 */
/* ------------------------------------------------------------------ */
void hal_adc_init_scan(ADC_Type *adc, const uint8_t *channels, uint8_t count, uint8_t sample_time)
{
    adc->CR2 = 0;
    adc->CR1 = ADC_CR1_SCAN;
    adc->SMPR2 = 0;
    adc->SQR3 = 0;
    adc->SQR2 = 0;
    for (uint8_t i = 0; i < count; i++) {
        uint8_t ch = channels[i];
        adc->SMPR2 |= ((uint32_t)sample_time & 7U) << (ch * 3U);
        if (i < 6U) {
            adc->SQR3 |= (uint32_t)ch << (i * 5U);
        } else {
            adc->SQR2 |= (uint32_t)ch << ((i - 6U) * 5U);
        }
    }
    adc->SQR1 = (uint32_t)(count - 1U) << 20;
    adc->CR2 = ADC_CR2_ADON | ADC_CR2_CONT | ADC_CR2_DMA | ADC_CR2_DDS;
}

void hal_adc_start(ADC_Type *adc)
{
    adc->CR2 |= ADC_CR2_SWSTART;
}

/* ------------------------------------------------------------------ */
/* FLASH                                                               */
/* ------------------------------------------------------------------ */
int hal_flash_unlock(void)
{
    if (FLASH->CR & FLASH_CR_LOCK) {
        FLASH->KEYR = FLASH_KEY1;
        FLASH->KEYR = FLASH_KEY2;
    }
    return (FLASH->CR & FLASH_CR_LOCK) ? -1 : 0;
}

void hal_flash_lock(void)
{
    FLASH->CR |= FLASH_CR_LOCK;
}

/* Sector erase. Typical 0.5 s, maximum 2 s for a 128 KB sector (see the N4 datasheet). */
int hal_flash_erase_sector(uint8_t sector)
{
    while (FLASH->SR & FLASH_SR_BSY) {
    }
    FLASH->CR = FLASH_CR_PSIZE_32 | FLASH_CR_SER | ((uint32_t)sector << FLASH_CR_SNB_POS);
    FLASH->CR |= FLASH_CR_STRT;
    while (FLASH->SR & FLASH_SR_BSY) {
    }
    FLASH->CR &= ~FLASH_CR_SER;
    return (FLASH->SR & FLASH_SR_PGSERR) ? -1 : 0;
}

int hal_flash_program_word(uint32_t addr, uint32_t word)
{
    while (FLASH->SR & FLASH_SR_BSY) {
    }
    FLASH->CR = FLASH_CR_PSIZE_32 | FLASH_CR_PG;
    *(volatile uint32_t *)addr = word;
    while (FLASH->SR & FLASH_SR_BSY) {
    }
    FLASH->CR &= ~FLASH_CR_PG;
    return (FLASH->SR & FLASH_SR_PGSERR) ? -1 : 0;
}

/* ------------------------------------------------------------------ */
/* SPI                                                                 */
/* ------------------------------------------------------------------ */
void hal_spi_init(SPI_Type *spi, uint32_t pclk_hz, uint32_t max_hz)
{
    uint32_t br = 0;
    while (br < 7U && (pclk_hz >> (br + 1U)) > max_hz) {
        br++;
    }
    spi->CR1 = SPI_CR1_MSTR | SPI_CR1_SSM | SPI_CR1_SSI | (br << 3);
    spi->CR1 |= SPI_CR1_SPE;
}

uint8_t hal_spi_xfer(SPI_Type *spi, uint8_t out)
{
    while ((spi->SR & SPI_SR_TXE) == 0U) {
    }
    spi->DR = out;
    while ((spi->SR & SPI_SR_RXNE) == 0U) {
    }
    return (uint8_t)spi->DR;
}

/* ------------------------------------------------------------------ */
/* clocks                                                              */
/* ------------------------------------------------------------------ */
uint32_t hal_rcc_pclk1(void)
{
    uint32_t ppre1 = (RCC->CFGR >> 10) & 7U;
    return (ppre1 < 4U) ? SystemCoreClock : SystemCoreClock >> (ppre1 - 3U);
}

uint32_t hal_rcc_pclk2(void)
{
    uint32_t ppre2 = (RCC->CFGR >> 13) & 7U;
    return (ppre2 < 4U) ? SystemCoreClock : SystemCoreClock >> (ppre2 - 3U);
}

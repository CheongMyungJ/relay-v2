/*
 * nimbus_hal_ext.c - Nimbus N4 HAL: I2C, RTC, CAN and EXTI helpers
 *
 * Copyright (c) 2017 Nimbus Semiconductor Ltd.
 * Distributed under the Nimbus Device Software License v2. Do not modify.
 */
#include "nimbus_hal.h"
#include "nimbus_ext.h"

/* ------------------------------------------------------------------ */
/* I2C (standard and fast mode, polled)                                */
/* ------------------------------------------------------------------ */
#define I2C_CR1_PE          (1UL << 0)
#define I2C_CR1_START       (1UL << 8)
#define I2C_CR1_STOP        (1UL << 9)
#define I2C_CR1_ACK         (1UL << 10)
#define I2C_SR1_SB          (1UL << 0)
#define I2C_SR1_ADDR        (1UL << 1)
#define I2C_SR1_BTF         (1UL << 2)
#define I2C_SR1_RXNE        (1UL << 6)
#define I2C_SR1_TXE         (1UL << 7)
#define I2C_SR1_AF          (1UL << 10)
#define I2C_TIMEOUT         100000UL

static int i2c_wait(I2C_Type *i2c, uint32_t flag)
{
    uint32_t n = I2C_TIMEOUT;
    while ((i2c->SR1 & flag) == 0U) {
        if ((i2c->SR1 & I2C_SR1_AF) != 0U || --n == 0U) {
            i2c->SR1 &= ~I2C_SR1_AF;
            i2c->CR1 |= I2C_CR1_STOP;
            return -1;
        }
    }
    return 0;
}

void hal_i2c_init(I2C_Type *i2c, uint32_t pclk_hz, uint32_t bus_hz)
{
    uint32_t mhz = pclk_hz / 1000000UL;
    i2c->CR1 = 0;
    i2c->CR2 = mhz;
    if (bus_hz <= 100000UL) {
        i2c->CCR = pclk_hz / (2UL * bus_hz);
        i2c->TRISE = mhz + 1UL;
    } else {
        i2c->CCR = (1UL << 15) | (pclk_hz / (3UL * bus_hz));
        i2c->TRISE = (mhz * 300UL) / 1000UL + 1UL;
    }
    i2c->CR1 = I2C_CR1_PE;
}

int hal_i2c_write(I2C_Type *i2c, uint8_t addr7, const uint8_t *data, uint16_t len)
{
    i2c->CR1 |= I2C_CR1_START;
    if (i2c_wait(i2c, I2C_SR1_SB) != 0) {
        return -1;
    }
    i2c->DR = (uint32_t)addr7 << 1;
    if (i2c_wait(i2c, I2C_SR1_ADDR) != 0) {
        return -1;
    }
    (void)i2c->SR2;
    for (uint16_t i = 0; i < len; i++) {
        if (i2c_wait(i2c, I2C_SR1_TXE) != 0) {
            return -1;
        }
        i2c->DR = data[i];
    }
    if (i2c_wait(i2c, I2C_SR1_BTF) != 0) {
        return -1;
    }
    i2c->CR1 |= I2C_CR1_STOP;
    return 0;
}

int hal_i2c_read(I2C_Type *i2c, uint8_t addr7, uint8_t *data, uint16_t len)
{
    if (len == 0U) {
        return 0;
    }
    i2c->CR1 |= I2C_CR1_START | I2C_CR1_ACK;
    if (i2c_wait(i2c, I2C_SR1_SB) != 0) {
        return -1;
    }
    i2c->DR = ((uint32_t)addr7 << 1) | 1UL;
    if (i2c_wait(i2c, I2C_SR1_ADDR) != 0) {
        return -1;
    }
    if (len == 1U) {
        i2c->CR1 &= ~I2C_CR1_ACK;
    }
    (void)i2c->SR2;
    for (uint16_t i = 0; i < len; i++) {
        if (i == (uint16_t)(len - 1U)) {
            i2c->CR1 &= ~I2C_CR1_ACK;
            i2c->CR1 |= I2C_CR1_STOP;
        }
        if (i2c_wait(i2c, I2C_SR1_RXNE) != 0) {
            return -1;
        }
        data[i] = (uint8_t)i2c->DR;
    }
    return 0;
}

/* ------------------------------------------------------------------ */
/* RTC (LSE 32.768 kHz, calendar in BCD)                               */
/* ------------------------------------------------------------------ */
#define RTC_ISR_INIT        (1UL << 7)
#define RTC_ISR_INITF       (1UL << 6)
#define RTC_ISR_RSF         (1UL << 5)

static uint8_t bcd(uint8_t v)
{
    return (uint8_t)(((v / 10U) << 4) | (v % 10U));
}

static uint8_t from_bcd(uint8_t v)
{
    return (uint8_t)(((v >> 4) * 10U) + (v & 0x0FU));
}

static void rtc_unlock(void)
{
    RTC->WPR = 0xCAU;
    RTC->WPR = 0x53U;
}

void hal_rtc_init(void)
{
    rtc_unlock();
    RTC->ISR |= RTC_ISR_INIT;
    while ((RTC->ISR & RTC_ISR_INITF) == 0U) {
    }
    RTC->PRER = (127UL << 16) | 255UL;     /* 32768 / 128 / 256 = 1 Hz */
    RTC->ISR &= ~RTC_ISR_INIT;
    RTC->WPR = 0xFFU;
}

void hal_rtc_set(const hal_rtc_time_t *t)
{
    rtc_unlock();
    RTC->ISR |= RTC_ISR_INIT;
    while ((RTC->ISR & RTC_ISR_INITF) == 0U) {
    }
    RTC->TR = ((uint32_t)bcd(t->hour) << 16) | ((uint32_t)bcd(t->minute) << 8) | bcd(t->second);
    RTC->DR = ((uint32_t)bcd(t->year) << 16) | ((uint32_t)bcd(t->month) << 8) | bcd(t->day);
    RTC->ISR &= ~RTC_ISR_INIT;
    RTC->WPR = 0xFFU;
}

void hal_rtc_get(hal_rtc_time_t *t)
{
    RTC->ISR &= ~RTC_ISR_RSF;
    while ((RTC->ISR & RTC_ISR_RSF) == 0U) {
    }
    uint32_t tr = RTC->TR;
    uint32_t dr = RTC->DR;
    t->hour = from_bcd((uint8_t)((tr >> 16) & 0x3FU));
    t->minute = from_bcd((uint8_t)((tr >> 8) & 0x7FU));
    t->second = from_bcd((uint8_t)(tr & 0x7FU));
    t->year = from_bcd((uint8_t)((dr >> 16) & 0xFFU));
    t->month = from_bcd((uint8_t)((dr >> 8) & 0x1FU));
    t->day = from_bcd((uint8_t)(dr & 0x3FU));
}

/* ------------------------------------------------------------------ */
/* CAN (classic, polled mailbox 0, FIFO 0)                             */
/* ------------------------------------------------------------------ */
#define CAN_MCR_INRQ        (1UL << 0)
#define CAN_MSR_INAK        (1UL << 0)
#define CAN_TSR_TME0        (1UL << 26)
#define CAN_TIR_TXRQ        (1UL << 0)
#define CAN_RF0R_FMP0       (3UL << 0)
#define CAN_RF0R_RFOM0      (1UL << 5)

int hal_can_init(CAN_Type *can, uint32_t pclk_hz, uint32_t bitrate)
{
    can->MCR |= CAN_MCR_INRQ;
    while ((can->MSR & CAN_MSR_INAK) == 0U) {
    }
    /* 1 + 13 + 2 = 16 time quanta per bit */
    uint32_t brp = pclk_hz / (bitrate * 16UL);
    if (brp == 0U || brp > 1024U) {
        return -1;
    }
    can->BTR = (1UL << 20) | (12UL << 16) | (brp - 1UL);
    can->MCR &= ~CAN_MCR_INRQ;
    while (can->MSR & CAN_MSR_INAK) {
    }
    return 0;
}

int hal_can_send(CAN_Type *can, uint16_t id, const uint8_t *data, uint8_t len)
{
    if ((can->TSR & CAN_TSR_TME0) == 0U || len > 8U) {
        return -1;
    }
    uint32_t lo = 0;
    uint32_t hi = 0;
    for (uint8_t i = 0; i < len; i++) {
        if (i < 4U) {
            lo |= (uint32_t)data[i] << (8U * i);
        } else {
            hi |= (uint32_t)data[i] << (8U * (i - 4U));
        }
    }
    can->TX[0].TDTR = len;
    can->TX[0].TDLR = lo;
    can->TX[0].TDHR = hi;
    can->TX[0].TIR = ((uint32_t)id << 21) | CAN_TIR_TXRQ;
    return 0;
}

int hal_can_receive(CAN_Type *can, uint16_t *id, uint8_t *data, uint8_t *len)
{
    if ((can->RF0R & CAN_RF0R_FMP0) == 0U) {
        return -1;
    }
    *id = (uint16_t)(can->RX[0].RIR >> 21);
    *len = (uint8_t)(can->RX[0].RDTR & 0x0FU);
    uint32_t lo = can->RX[0].RDLR;
    uint32_t hi = can->RX[0].RDHR;
    for (uint8_t i = 0; i < *len && i < 8U; i++) {
        data[i] = (uint8_t)((i < 4U) ? (lo >> (8U * i)) : (hi >> (8U * (i - 4U))));
    }
    can->RF0R |= CAN_RF0R_RFOM0;
    return 0;
}

/* ------------------------------------------------------------------ */
/* EXTI                                                                */
/* ------------------------------------------------------------------ */
void hal_exti_enable(uint8_t line, int rising, int falling)
{
    if (rising) {
        EXTI->RTSR |= 1UL << line;
    } else {
        EXTI->RTSR &= ~(1UL << line);
    }
    if (falling) {
        EXTI->FTSR |= 1UL << line;
    } else {
        EXTI->FTSR &= ~(1UL << line);
    }
    EXTI->IMR |= 1UL << line;
}

void hal_exti_clear(uint8_t line)
{
    EXTI->PR = 1UL << line;
}

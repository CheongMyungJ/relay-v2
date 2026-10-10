/*
 * nimbus_ext.h - Nimbus N4: I2C, RTC, CAN and EXTI register maps and helpers
 *
 * Copyright (c) 2017 Nimbus Semiconductor Ltd.
 * Distributed under the Nimbus Device Software License v2. Do not modify.
 */
#ifndef NIMBUS_EXT_H
#define NIMBUS_EXT_H

#include <stdint.h>
#include "nimbus_n4.h"

typedef struct {
    __IO uint32_t CR1;
    __IO uint32_t CR2;
    __IO uint32_t OAR1;
    __IO uint32_t OAR2;
    __IO uint32_t DR;
    __IO uint32_t SR1;
    __IO uint32_t SR2;
    __IO uint32_t CCR;
    __IO uint32_t TRISE;
} I2C_Type;

#define I2C1    ((I2C_Type *)0x40005400UL)
#define I2C2    ((I2C_Type *)0x40005800UL)

typedef struct {
    __IO uint32_t TR;
    __IO uint32_t DR;
    __IO uint32_t CR;
    __IO uint32_t ISR;
    __IO uint32_t PRER;
    __IO uint32_t WUTR;
    uint32_t RESERVED0[3];
    __IO uint32_t WPR;
} RTC_Type;

#define RTC     ((RTC_Type *)0x40002800UL)

typedef struct {
    __IO uint32_t TIR;
    __IO uint32_t TDTR;
    __IO uint32_t TDLR;
    __IO uint32_t TDHR;
} CAN_TxMailbox_Type;

typedef struct {
    __IO uint32_t RIR;
    __IO uint32_t RDTR;
    __IO uint32_t RDLR;
    __IO uint32_t RDHR;
} CAN_FIFOMailbox_Type;

typedef struct {
    __IO uint32_t MCR;
    __IO uint32_t MSR;
    __IO uint32_t TSR;
    __IO uint32_t RF0R;
    __IO uint32_t RF1R;
    __IO uint32_t IER;
    __IO uint32_t ESR;
    __IO uint32_t BTR;
    uint32_t RESERVED0[88];
    CAN_TxMailbox_Type TX[3];
    CAN_FIFOMailbox_Type RX[2];
} CAN_Type;

#define CAN1    ((CAN_Type *)0x40006400UL)

typedef struct {
    __IO uint32_t IMR;
    __IO uint32_t EMR;
    __IO uint32_t RTSR;
    __IO uint32_t FTSR;
    __IO uint32_t SWIER;
    __IO uint32_t PR;
} EXTI_Type;

#define EXTI    ((EXTI_Type *)0x40013C00UL)

typedef struct {
    uint8_t year;
    uint8_t month;
    uint8_t day;
    uint8_t hour;
    uint8_t minute;
    uint8_t second;
} hal_rtc_time_t;

void hal_i2c_init(I2C_Type *i2c, uint32_t pclk_hz, uint32_t bus_hz);
int hal_i2c_write(I2C_Type *i2c, uint8_t addr7, const uint8_t *data, uint16_t len);
int hal_i2c_read(I2C_Type *i2c, uint8_t addr7, uint8_t *data, uint16_t len);

void hal_rtc_init(void);
void hal_rtc_set(const hal_rtc_time_t *t);
void hal_rtc_get(hal_rtc_time_t *t);

int hal_can_init(CAN_Type *can, uint32_t pclk_hz, uint32_t bitrate);
int hal_can_send(CAN_Type *can, uint16_t id, const uint8_t *data, uint8_t len);
int hal_can_receive(CAN_Type *can, uint16_t *id, uint8_t *data, uint8_t *len);

void hal_exti_enable(uint8_t line, int rising, int falling);
void hal_exti_clear(uint8_t line);

#endif /* NIMBUS_EXT_H */

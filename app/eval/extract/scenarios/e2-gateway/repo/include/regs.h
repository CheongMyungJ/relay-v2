/*
 * regs.h - Modbus holding register map
 */
#ifndef REGS_H
#define REGS_H

#include <stdint.h>

/* measurements (read only) */
#define REG_TEMP0           0x0000U     /* 0.1 C */
#define REG_TEMP1           0x0001U     /* 0.1 C */
#define REG_PRESSURE        0x0002U     /* 0.01 bar, four-channel variants */
#define REG_HUMIDITY        0x0003U     /* 0.1 %RH, four-channel variants */
/* alarm and filter settings (read/write, stored in flash) */
#define REG_ALARM_HIGH      0x0010U     /* 0.1 C */
#define REG_ALARM_LOW       0x0011U     /* 0.1 C */
#define REG_AVG_WINDOW      0x0012U     /* samples */
/* communication settings (read/write, stored in flash, used after the next reset) */
#define REG_SLAVE_ADDR      0x0020U
#define REG_BAUD_CODE       0x0021U     /* 0 = 9600, 1 = 19200, 2 = 115200 */
/* status (read only) */
#define REG_UPTIME_LO       0x0030U     /* seconds */
#define REG_UPTIME_HI       0x0031U
#define REG_ALARM_STATE     0x0032U
#define REG_RX_FRAMES_0     0x0040U     /* 64-bit frame counter, least significant word first */
#define REG_RX_FRAMES_1     0x0041U
#define REG_RX_FRAMES_2     0x0042U
#define REG_RX_FRAMES_3     0x0043U
#define REG_CRC_ERRORS      0x0044U

/* results of regs_read / regs_write */
#define REG_OK              0
#define REG_NO_SUCH         (-1)
#define REG_READ_ONLY       (-2)
#define REG_OUT_OF_RANGE    (-3)
#define REG_BUSY            (-4)

int regs_read(uint16_t addr, uint16_t *value);
int regs_write(uint16_t addr, uint16_t value);
int regs_exists(uint16_t addr);

extern volatile uint32_t g_uptime_s;

#endif /* REGS_H */

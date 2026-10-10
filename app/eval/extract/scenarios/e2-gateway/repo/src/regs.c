/*
 * regs.c - holding register map
 *
 * Measurements come from g_sensor (under g_sensor_mutex). Settings registers are
 * kept in g_settings and written to flash by the settings task; while a save is in
 * progress, writes to settings registers are refused with REG_BUSY.
 */
#include "regs.h"
#include "sensor.h"
#include "stats.h"
#include "misc.h"
#include "app.h"

#define F_RO        0x01U
#define F_SETTING   0x02U       /* stored in flash */
#define F_4CH       0x04U       /* only on four-channel variants */

struct reg_def {
    uint16_t addr;
    uint8_t flags;
    int16_t min;
    int16_t max;
};

static const struct reg_def s_regs[] = {
    { REG_TEMP0,        F_RO,                   0,      0 },
    { REG_TEMP1,        F_RO,                   0,      0 },
    { REG_PRESSURE,     F_RO | F_4CH,           0,      0 },
    { REG_HUMIDITY,     F_RO | F_4CH,           0,      0 },
    { REG_ALARM_HIGH,   F_SETTING,              -400,   1250 },
    { REG_ALARM_LOW,    F_SETTING,              -400,   1250 },
    { REG_AVG_WINDOW,   F_SETTING,              1,      64 },
    { REG_SLAVE_ADDR,   F_SETTING,              1,      247 },
    { REG_BAUD_CODE,    F_SETTING,              0,      2 },
    { REG_UPTIME_LO,    F_RO,                   0,      0 },
    { REG_UPTIME_HI,    F_RO,                   0,      0 },
    { REG_ALARM_STATE,  F_RO,                   0,      0 },
    { REG_RX_FRAMES_0,  F_RO,                   0,      0 },
    { REG_RX_FRAMES_1,  F_RO,                   0,      0 },
    { REG_RX_FRAMES_2,  F_RO,                   0,      0 },
    { REG_RX_FRAMES_3,  F_RO,                   0,      0 },
    { REG_CRC_ERRORS,   F_RO,                   0,      0 },
};

#define REG_COUNT   (sizeof(s_regs) / sizeof(s_regs[0]))

volatile uint32_t g_uptime_s;

static const struct reg_def *find(uint16_t addr)
{
    for (uint32_t i = 0; i < REG_COUNT; i++) {
        if (s_regs[i].addr == addr) {
            if ((s_regs[i].flags & F_4CH) && CFG_SENSOR_CHANNELS < 4U) {
                return 0;
            }
            return &s_regs[i];
        }
    }
    return 0;
}

int regs_exists(uint16_t addr)
{
    return find(addr) != 0;
}

static uint16_t alarm_state(void)
{
    int16_t t = g_sensor.value[0];
    if (t > g_settings.alarm_high) {
        return 1U;
    }
    if (t < g_settings.alarm_low) {
        return 2U;
    }
    return 0U;
}

int regs_read(uint16_t addr, uint16_t *value)
{
    const struct reg_def *r = find(addr);
    if (r == 0) {
        return REG_NO_SUCH;
    }
    switch (addr) {
    case REG_TEMP0:
    case REG_TEMP1:
    case REG_PRESSURE:
    case REG_HUMIDITY:
    case REG_ALARM_STATE:
        if (mutex_lock(g_sensor_mutex, pdMS_TO_TICKS(10U)) != pdPASS) {
            return REG_BUSY;
        }
        *value = (addr == REG_ALARM_STATE) ? alarm_state() : (uint16_t)g_sensor.value[addr - REG_TEMP0];
        mutex_unlock(g_sensor_mutex);
        return REG_OK;
    case REG_ALARM_HIGH:
        *value = (uint16_t)g_settings.alarm_high;
        return REG_OK;
    case REG_ALARM_LOW:
        *value = (uint16_t)g_settings.alarm_low;
        return REG_OK;
    case REG_AVG_WINDOW:
        *value = g_settings.avg_window;
        return REG_OK;
    case REG_SLAVE_ADDR:
        *value = g_settings.slave_addr;
        return REG_OK;
    case REG_BAUD_CODE:
        *value = g_settings.baud_code;
        return REG_OK;
    case REG_UPTIME_LO:
        *value = (uint16_t)(g_uptime_s & 0xFFFFU);
        return REG_OK;
    case REG_UPTIME_HI:
        *value = (uint16_t)(g_uptime_s >> 16);
        return REG_OK;
    case REG_RX_FRAMES_0:
    case REG_RX_FRAMES_1:
    case REG_RX_FRAMES_2:
    case REG_RX_FRAMES_3: {
        uint64_t frames = g_stats.rx_frames;
        *value = (uint16_t)(frames >> (16U * (addr - REG_RX_FRAMES_0)));
        return REG_OK;
    }
    case REG_CRC_ERRORS:
        *value = (uint16_t)g_stats.crc_errors;
        return REG_OK;
    default:
        return REG_NO_SUCH;
    }
}

int regs_write(uint16_t addr, uint16_t value)
{
    const struct reg_def *r = find(addr);
    if (r == 0) {
        return REG_NO_SUCH;
    }
    if (r->flags & F_RO) {
        return REG_READ_ONLY;
    }
    int16_t v = (int16_t)value;
    if (v < r->min || v > r->max) {
        return REG_OUT_OF_RANGE;
    }
    if (g_cfg_busy) {
        return REG_BUSY;
    }
    switch (addr) {
    case REG_ALARM_HIGH:
        g_settings.alarm_high = v;
        break;
    case REG_ALARM_LOW:
        g_settings.alarm_low = v;
        break;
    case REG_AVG_WINDOW:
        g_settings.avg_window = (uint16_t)v;
        g_avg_window = (uint16_t)v;
        sensor_reset_filter();
        break;
    case REG_SLAVE_ADDR:
        g_settings.slave_addr = (uint8_t)v;
        break;
    case REG_BAUD_CODE:
        g_settings.baud_code = (uint8_t)v;
        break;
    default:
        return REG_NO_SUCH;
    }
    config_request_save();
    return REG_OK;
}

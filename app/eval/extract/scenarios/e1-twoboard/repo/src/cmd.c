/*
 * cmd.c - host command handlers
 */
#include "cmd.h"
#include "proto.h"
#include "control.h"
#include "fault.h"
#include "eeprom.h"
#include "uart.h"
#include "hwrev.h"
#include "version.h"
#include "board.h"
#if CFG_FEATURE_FAN
#include "fan.h"
#endif

typedef uint8_t (*cmd_fn)(const uint8_t *p, uint8_t len, uint8_t *out, uint8_t *out_len);

struct cmd_entry {
    uint8_t id;
    uint8_t min_len;
    uint8_t max_len;
    cmd_fn fn;
};

static uint8_t cmd_get_temp(const uint8_t *p, uint8_t len, uint8_t *out, uint8_t *out_len)
{
    int16_t t = control_temp_dc();
    (void)p;
    (void)len;
    out[0] = (uint8_t)(t & 0xFF);
    out[1] = (uint8_t)((uint16_t)t >> 8);
    *out_len = 2U;
    return ERR_OK;
}

/* payload: setpoint in 0.1 C, little endian */
static uint8_t cmd_set_setpoint(const uint8_t *p, uint8_t len, uint8_t *out, uint8_t *out_len)
{
    int16_t sp = (int16_t)(p[0] | ((uint16_t)p[1] << 8));
    (void)len;
    (void)out;
    *out_len = 0U;

    if (g_fault_flags & FAULT_OVERTEMP) {
        return ERR_FAULT;
    }
    if (sp < SETPOINT_MIN_DC || sp > SETPOINT_MAX_DC) {
        return ERR_RANGE;
    }
    if (ee_busy()) {
        return ERR_BUSY;
    }
    g_setpoint_dc = sp;
    ee_request_save();
    return ERR_OK;
}

static uint8_t cmd_get_status(const uint8_t *p, uint8_t len, uint8_t *out, uint8_t *out_len)
{
    (void)p;
    (void)len;
    out[0] = g_fault_flags;
    out[1] = g_mode;
    out[2] = (uint8_t)(g_rx_overruns & 0xFFU);
    out[3] = g_hw_rev;
    *out_len = 4U;
    return ERR_OK;
}

/* payload: mask of fault bits to clear */
static uint8_t cmd_reset_fault(const uint8_t *p, uint8_t len, uint8_t *out, uint8_t *out_len)
{
    (void)len;
    (void)out;
    *out_len = 0U;
    fault_clear(p[0]);
    return ERR_OK;
}

#if CFG_FEATURE_MODE
static uint8_t cmd_set_mode(const uint8_t *p, uint8_t len, uint8_t *out, uint8_t *out_len)
{
    (void)len;
    (void)out;
    *out_len = 0U;
    if (p[0] > MODE_AUTO) {
        return ERR_RANGE;
    }
    if (ee_busy()) {
        return ERR_BUSY;
    }
    g_mode = p[0];
    ee_request_save();
    return ERR_OK;
}
#endif

#if CFG_FEATURE_FAN
/* payload: fan duty 0..100 % */
static uint8_t cmd_set_fan(const uint8_t *p, uint8_t len, uint8_t *out, uint8_t *out_len)
{
    (void)len;
    (void)out;
    *out_len = 0U;
    if (p[0] > 100U) {
        return ERR_RANGE;
    }
    fan_set_duty(p[0]);
    return ERR_OK;
}
#endif

static uint8_t cmd_get_version(const uint8_t *p, uint8_t len, uint8_t *out, uint8_t *out_len)
{
    (void)p;
    (void)len;
    out[0] = FW_VERSION_MAJOR;
    out[1] = FW_VERSION_MINOR;
    out[2] = FW_VERSION_PATCH;
    *out_len = 3U;
    return ERR_OK;
}

static const struct cmd_entry cmd_table[] = {
    { CMD_GET_TEMP,     0U, 0U, cmd_get_temp },
    { CMD_SET_SETPOINT, 2U, 2U, cmd_set_setpoint },
    { CMD_GET_STATUS,   0U, 0U, cmd_get_status },
    { CMD_RESET_FAULT,  1U, 1U, cmd_reset_fault },
#if CFG_FEATURE_MODE
    { CMD_SET_MODE,     1U, 1U, cmd_set_mode },
#endif
#if CFG_FEATURE_FAN
    { CMD_SET_FAN,      1U, 1U, cmd_set_fan },
#endif
    { CMD_GET_VERSION,  0U, 0U, cmd_get_version },
};

void cmd_dispatch(uint8_t cmd, const uint8_t *payload, uint8_t len)
{
    uint8_t out[PROTO_MAX_PAYLOAD - 1U];
    uint8_t out_len = 0U;

    for (uint8_t i = 0; i < sizeof(cmd_table) / sizeof(cmd_table[0]); i++) {
        const struct cmd_entry *e = &cmd_table[i];
        if (e->id != cmd) {
            continue;
        }
        if (len < e->min_len || len > e->max_len) {
            proto_send(cmd, ERR_BAD_LEN, 0, 0U);
            return;
        }
        uint8_t status = e->fn(payload, len, out, &out_len);
        proto_send(cmd, status, out, out_len);
        return;
    }
    proto_send(cmd, ERR_UNKNOWN_CMD, 0, 0U);
}

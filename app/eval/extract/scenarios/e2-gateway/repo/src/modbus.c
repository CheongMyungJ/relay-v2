/*
 * modbus.c - Modbus RTU slave: frame checks, dispatch and the comm task
 *
 * Function handlers are registered at start-up (app_init.c); a request for a
 * function code without a handler gets exception 01.
 */
#include <string.h>
#include "modbus.h"
#include "rs485.h"
#include "stats.h"
#include "misc.h"
#include "app.h"

#define MB_MAX_HANDLERS     8U

struct mb_handler {
    uint8_t fc;
    mb_handler_fn fn;
};

static struct mb_handler s_handlers[MB_MAX_HANDLERS];
static uint8_t s_handler_count;
uint8_t g_slave_addr;

/* CRC-16 as used by Modbus RTU */
uint16_t mb_crc16(const uint8_t *data, uint16_t len)
{
    uint16_t crc = 0xFFFFU;
    for (uint16_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (uint8_t b = 0; b < 8U; b++) {
            crc = (crc & 1U) ? (uint16_t)((crc >> 1) ^ 0xA001U) : (uint16_t)(crc >> 1);
        }
    }
    return crc;
}

void mb_init(uint8_t slave_addr)
{
    g_slave_addr = slave_addr;
    s_handler_count = 0;
}

int mb_register(uint8_t function_code, mb_handler_fn fn)
{
    if (s_handler_count >= MB_MAX_HANDLERS) {
        return -1;
    }
    s_handlers[s_handler_count].fc = function_code;
    s_handlers[s_handler_count].fn = fn;
    s_handler_count++;
    return 0;
}

static mb_handler_fn find_handler(uint8_t fc)
{
    for (uint8_t i = 0; i < s_handler_count; i++) {
        if (s_handlers[i].fc == fc) {
            return s_handlers[i].fn;
        }
    }
    return 0;
}

/* builds the reply ADU in out (address, PDU, CRC) and returns its length */
static uint16_t build_reply(uint8_t *out, const mb_frame_t *req, uint16_t *pdu_len_out)
{
    const uint8_t *pdu = &req->data[1];
    uint16_t pdu_len = (uint16_t)(req->len - 3U);
    uint16_t resp_len = 0;
    uint8_t *resp = &out[1];
    uint8_t ex;

    mb_handler_fn fn = find_handler(pdu[0]);
    if (fn == 0) {
        ex = MB_EX_ILLEGAL_FUNCTION;
    } else {
        ex = fn(pdu, pdu_len, resp, &resp_len);
    }
    if (ex != MB_EX_NONE) {
        resp[0] = (uint8_t)(pdu[0] | 0x80U);
        resp[1] = ex;
        resp_len = 2U;
        g_stats.exceptions++;
    }
    out[0] = g_slave_addr;
    uint16_t crc = mb_crc16(out, (uint16_t)(resp_len + 1U));
    out[resp_len + 1U] = (uint8_t)(crc & 0xFFU);
    out[resp_len + 2U] = (uint8_t)(crc >> 8);
    *pdu_len_out = resp_len;
    return (uint16_t)(resp_len + 3U);
}

void mb_task(void *arg)
{
    static mb_frame_t req;
    static uint8_t reply[MB_FRAME_MAX];
    (void)arg;

    for (;;) {
        if (queue_receive(g_mb_rx_q, &req, pdMS_TO_TICKS(MB_IDLE_POLL_MS)) != pdPASS) {
            wdog_alive(WDOG_COMM);
            continue;
        }
        wdog_alive(WDOG_COMM);

        if (req.len < 4U) {
            g_stats.short_frames++;
            continue;
        }
        /* the CRC over a whole valid frame (CRC included) is zero */
        if (mb_crc16(req.data, req.len) != 0U) {
            g_stats.crc_errors++;
            continue;
        }
        uint8_t addr = req.data[0];
        if (addr != g_slave_addr && addr != MB_BROADCAST) {
            continue;
        }

        uint16_t pdu_len;
        uint16_t n = build_reply(reply, &req, &pdu_len);
        if (addr == MB_BROADCAST) {
            continue;   /* broadcasts are executed but never answered */
        }
        task_delay(pdMS_TO_TICKS(MB_RESP_DELAY_MS));
        (void)rs485_send(reply, n);
    }
}

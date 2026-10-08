/*
 * mb_handlers.c - Modbus function handlers
 */
#include <string.h>
#include "modbus.h"
#include "regs.h"
#include "stats.h"
#include "misc.h"

static uint16_t be16(const uint8_t *p)
{
    return (uint16_t)(((uint16_t)p[0] << 8) | p[1]);
}

static void put_be16(uint8_t *p, uint16_t v)
{
    p[0] = (uint8_t)(v >> 8);
    p[1] = (uint8_t)(v & 0xFFU);
}

static uint8_t to_exception(int r)
{
    switch (r) {
    case REG_OK:
        return MB_EX_NONE;
    case REG_NO_SUCH:
    case REG_READ_ONLY:
        return MB_EX_ILLEGAL_ADDRESS;
    case REG_OUT_OF_RANGE:
        return MB_EX_ILLEGAL_VALUE;
    case REG_BUSY:
        return MB_EX_DEVICE_BUSY;
    default:
        return MB_EX_DEVICE_FAILURE;
    }
}

/* 0x03: start (2), quantity (2) */
uint8_t mb_fc03_read_holding(const uint8_t *req, uint16_t req_len, uint8_t *resp, uint16_t *resp_len)
{
    if (req_len != 5U) {
        return MB_EX_ILLEGAL_VALUE;
    }
    uint16_t start = be16(&req[1]);
    uint16_t qty = be16(&req[3]);
    if (qty == 0U || qty > MB_MAX_READ_REGS) {
        return MB_EX_ILLEGAL_VALUE;
    }
    for (uint16_t i = 0; i < qty; i++) {
        if (!regs_exists((uint16_t)(start + i))) {
            return MB_EX_ILLEGAL_ADDRESS;
        }
    }
    resp[0] = MB_FC_READ_HOLDING;
    resp[1] = (uint8_t)(qty * 2U);
    for (uint16_t i = 0; i < qty; i++) {
        uint16_t v;
        int r = regs_read((uint16_t)(start + i), &v);
        if (r != REG_OK) {
            return to_exception(r);
        }
        put_be16(&resp[2U + i * 2U], v);
    }
    *resp_len = (uint16_t)(2U + qty * 2U);
    return MB_EX_NONE;
}

/* 0x06: address (2), value (2); the reply echoes the request */
uint8_t mb_fc06_write_single(const uint8_t *req, uint16_t req_len, uint8_t *resp, uint16_t *resp_len)
{
    if (req_len != 5U) {
        return MB_EX_ILLEGAL_VALUE;
    }
    int r = regs_write(be16(&req[1]), be16(&req[3]));
    if (r != REG_OK) {
        return to_exception(r);
    }
    memcpy(resp, req, 5U);
    *resp_len = 5U;
    return MB_EX_NONE;
}

/* request PDU of 0x10, as it appears on the wire */
struct __attribute__((packed)) fc16_req {
    uint8_t fc;
    uint8_t start[2];
    uint8_t qty[2];
    uint8_t byte_count;
    uint8_t values[];
};

/* 0x10: start (2), quantity (2), byte count (1), values */
uint8_t mb_fc16_write_multiple(const uint8_t *req, uint16_t req_len, uint8_t *resp, uint16_t *resp_len)
{
    const struct fc16_req *r = (const struct fc16_req *)req;
    if (req_len < 6U) {
        return MB_EX_ILLEGAL_VALUE;
    }
    uint16_t start = be16(r->start);
    uint16_t qty = be16(r->qty);
    if (qty == 0U || qty > MB_MAX_WRITE_REGS || r->byte_count != qty * 2U ||
        req_len != (uint16_t)(6U + r->byte_count)) {
        return MB_EX_ILLEGAL_VALUE;
    }
    for (uint16_t i = 0; i < qty; i++) {
        if (!regs_exists((uint16_t)(start + i))) {
            return MB_EX_ILLEGAL_ADDRESS;
        }
    }
    for (uint16_t i = 0; i < qty; i++) {
        int w = regs_write((uint16_t)(start + i), be16(&r->values[i * 2U]));
        if (w != REG_OK) {
            return to_exception(w);
        }
    }
    resp[0] = MB_FC_WRITE_MULTIPLE;
    put_be16(&resp[1], start);
    put_be16(&resp[3], qty);
    *resp_len = 5U;
    return MB_EX_NONE;
}

/* 0x17: read/write multiple registers (kept for the planned GW-500 protocol) */
uint8_t mb_fc23_read_write(const uint8_t *req, uint16_t req_len, uint8_t *resp, uint16_t *resp_len)
{
    if (req_len < 10U) {
        return MB_EX_ILLEGAL_VALUE;
    }
    uint16_t rd_start = be16(&req[1]);
    uint16_t rd_qty = be16(&req[3]);
    uint16_t wr_start = be16(&req[5]);
    uint16_t wr_qty = be16(&req[7]);
    if (rd_qty == 0U || rd_qty > MB_MAX_READ_REGS || wr_qty == 0U || wr_qty > MB_MAX_WRITE_REGS) {
        return MB_EX_ILLEGAL_VALUE;
    }
    for (uint16_t i = 0; i < wr_qty; i++) {
        int w = regs_write((uint16_t)(wr_start + i), be16(&req[10U + i * 2U]));
        if (w != REG_OK) {
            return to_exception(w);
        }
    }
    resp[0] = MB_FC_READ_WRITE;
    resp[1] = (uint8_t)(rd_qty * 2U);
    for (uint16_t i = 0; i < rd_qty; i++) {
        uint16_t v = 0;
        if (regs_read((uint16_t)(rd_start + i), &v) != REG_OK) {
            return MB_EX_ILLEGAL_ADDRESS;
        }
        put_be16(&resp[2U + i * 2U], v);
    }
    *resp_len = (uint16_t)(2U + rd_qty * 2U);
    return MB_EX_NONE;
}

/* 0x2B / MEI 0x0E: read device identification, basic category only */
uint8_t mb_fc43_device_id(const uint8_t *req, uint16_t req_len, uint8_t *resp, uint16_t *resp_len)
{
    static const char *const objects[3] = { "Acme Sensing", "GW-400", "3.2.0" };
    if (req_len != 4U || req[1] != 0x0EU) {
        return MB_EX_ILLEGAL_VALUE;
    }
    if (req[2] != 0x01U) {
        return MB_EX_ILLEGAL_VALUE;
    }
    uint16_t n = 0;
    resp[n++] = MB_FC_DEVICE_ID;
    resp[n++] = 0x0EU;
    resp[n++] = 0x01U;
    resp[n++] = 0x01U;     /* conformity level: basic, stream access */
    resp[n++] = 0x00U;     /* no more follows */
    resp[n++] = 0x00U;
    resp[n++] = 3U;
    for (uint8_t id = 0; id < 3U; id++) {
        uint8_t len = (uint8_t)strlen(objects[id]);
        resp[n++] = id;
        resp[n++] = len;
        memcpy(&resp[n], objects[id], len);
        n = (uint16_t)(n + len);
    }
    *resp_len = n;
    return MB_EX_NONE;
}

/* 0x08: diagnostics, sub-functions 0x0000 (echo) and 0x000A (clear counters) */
uint8_t mb_fc08_diagnostics(const uint8_t *req, uint16_t req_len, uint8_t *resp, uint16_t *resp_len)
{
    if (req_len < 3U) {
        return MB_EX_ILLEGAL_VALUE;
    }
    uint16_t sub = be16(&req[1]);
    if (sub == 0x0000U) {
        memcpy(resp, req, req_len);
        *resp_len = req_len;
        return MB_EX_NONE;
    }
    if (sub == 0x000AU && req_len == 5U) {
        stats_clear();
        memcpy(resp, req, 5U);
        *resp_len = 5U;
        return MB_EX_NONE;
    }
    return MB_EX_ILLEGAL_FUNCTION;
}

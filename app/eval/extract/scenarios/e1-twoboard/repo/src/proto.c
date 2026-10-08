/*
 * proto.c - host protocol framing
 *
 * Bytes come from g_rx_ring (filled by the USART1 ISR). A frame that stalls for
 * longer than PROTO_FRAME_TIMEOUT_TICKS between bytes is dropped without a reply.
 */
#include "proto.h"
#include "cmd.h"
#include "timer.h"
#include "uart.h"

enum parse_state { WAIT_SOF, WAIT_LEN, WAIT_CMD, WAIT_PAYLOAD, WAIT_CRC };

static enum parse_state s_state = WAIT_SOF;
static uint8_t s_len;
static uint8_t s_cmd;
static uint8_t s_pos;
static uint8_t s_payload[PROTO_MAX_PAYLOAD];
static uint32_t s_last_rx_tick;

volatile uint16_t g_frame_timeouts;

/* CRC-8, polynomial 0x31, initial value 0xFF, no reflection */
uint8_t proto_crc8(const uint8_t *data, uint8_t n, uint8_t crc)
{
    for (uint8_t i = 0; i < n; i++) {
        crc ^= data[i];
        for (uint8_t bit = 0; bit < 8U; bit++) {
            crc = (crc & 0x80U) ? (uint8_t)((crc << 1) ^ 0x31U) : (uint8_t)(crc << 1);
        }
    }
    return crc;
}

void proto_send(uint8_t cmd, uint8_t status, const uint8_t *data, uint8_t n)
{
    uint8_t frame[4 + PROTO_MAX_PAYLOAD + 1];
    uint8_t len = (uint8_t)(n + 1U);

    frame[0] = PROTO_SOF;
    frame[1] = len;
    frame[2] = (uint8_t)(cmd | PROTO_RESP_FLAG);
    frame[3] = status;
    for (uint8_t i = 0; i < n; i++) {
        frame[4 + i] = data[i];
    }
    frame[4 + n] = proto_crc8(&frame[1], (uint8_t)(len + 2U), 0xFFU);
    uart_send(frame, (uint8_t)(n + 5U));
}

static void handle_byte(uint8_t b)
{
    switch (s_state) {
    case WAIT_SOF:
        if (b == PROTO_SOF) {
            s_state = WAIT_LEN;
        }
        break;
    case WAIT_LEN:
        if (b > PROTO_MAX_PAYLOAD) {
            s_state = WAIT_SOF;     /* oversize: resynchronise silently */
            break;
        }
        s_len = b;
        s_state = WAIT_CMD;
        break;
    case WAIT_CMD:
        s_cmd = b;
        s_pos = 0;
        s_state = (s_len == 0U) ? WAIT_CRC : WAIT_PAYLOAD;
        break;
    case WAIT_PAYLOAD:
        s_payload[s_pos++] = b;
        if (s_pos == s_len) {
            s_state = WAIT_CRC;
        }
        break;
    case WAIT_CRC: {
        uint8_t hdr[2] = { s_len, s_cmd };
        uint8_t crc = proto_crc8(hdr, 2U, 0xFFU);
        crc = proto_crc8(s_payload, s_len, crc);
        s_state = WAIT_SOF;
        if (crc != b) {
            proto_send(s_cmd, ERR_CRC, 0, 0U);
            break;
        }
        cmd_dispatch(s_cmd, s_payload, s_len);
        break;
    }
    }
}

void proto_poll(void)
{
    uint8_t b;

    if (s_state != WAIT_SOF && (timer_now() - s_last_rx_tick) > PROTO_FRAME_TIMEOUT_TICKS) {
        s_state = WAIT_SOF;
        g_frame_timeouts++;
    }
    while (ring_get(&g_rx_ring, &b)) {
        s_last_rx_tick = timer_now();
        handle_byte(b);
    }
}

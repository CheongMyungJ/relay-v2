#ifndef PROTO_H
#define PROTO_H

#include <stdint.h>

/*
 * Frame: SOF LEN CMD PAYLOAD[LEN] CRC
 *   SOF = 0xA5, LEN = payload length (0..PROTO_MAX_PAYLOAD), CRC = CRC-8 over LEN, CMD, PAYLOAD
 * Response: SOF LEN (CMD | 0x80) STATUS DATA[LEN-1] CRC
 */
#define PROTO_SOF                   0xA5U
#define PROTO_MAX_PAYLOAD           16U
#define PROTO_FRAME_TIMEOUT_TICKS   20U     /* 20 ms inter-byte timeout */
#define PROTO_RESP_FLAG             0x80U

/* status codes */
#define ERR_OK              0x00U
#define ERR_UNKNOWN_CMD     0x01U
#define ERR_CRC             0x02U
#define ERR_RANGE           0x03U
#define ERR_BUSY            0x04U
#define ERR_BAD_LEN         0x05U
#define ERR_FAULT           0x06U

extern volatile uint16_t g_frame_timeouts;

void proto_poll(void);
void proto_send(uint8_t cmd, uint8_t status, const uint8_t *data, uint8_t n);
uint8_t proto_crc8(const uint8_t *data, uint8_t n, uint8_t crc);

#endif /* PROTO_H */

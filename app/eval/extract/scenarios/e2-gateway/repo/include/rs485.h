/*
 * rs485.h - RS-485 link on USART2 with DMA
 */
#ifndef RS485_H
#define RS485_H

#include <stdint.h>
#include "picortos.h"

#define RS485_RX_DMA_SIZE   256U
#define MB_FRAME_MAX        256U

typedef struct {
    uint16_t len;
    uint8_t data[MB_FRAME_MAX];
} mb_frame_t;

extern queue_t g_mb_rx_q;       /* mb_frame_t, filled by the USART2 idle-line interrupt */

void rs485_init(uint32_t baud);
int rs485_send(const uint8_t *data, uint16_t len);

#endif /* RS485_H */

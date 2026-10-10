#ifndef UART_H
#define UART_H

#include <stdint.h>
#include "ring.h"

extern ring_t g_rx_ring;
extern volatile uint16_t g_rx_overruns;

void uart_init(void);
void uart_send(const uint8_t *data, uint8_t len);

#endif /* UART_H */

#ifndef RING_H
#define RING_H

#include <stdint.h>

/* single-producer (USART1 ISR) / single-consumer (main loop) byte ring */
#define RING_SIZE   64U     /* must be a power of two */

typedef struct {
    volatile uint8_t head;  /* written only by the producer */
    volatile uint8_t tail;  /* written only by the consumer */
    uint8_t buf[RING_SIZE];
} ring_t;

int ring_put(ring_t *r, uint8_t b);
int ring_get(ring_t *r, uint8_t *b);

#endif /* RING_H */

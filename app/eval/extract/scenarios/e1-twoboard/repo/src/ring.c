/*
 * ring.c - lock-free byte ring for one producer and one consumer
 *
 * head is only written by the producer and tail only by the consumer, and both
 * are single bytes, so no locking is needed on this core.
 */
#include "ring.h"

int ring_put(ring_t *r, uint8_t b)
{
    uint8_t next = (uint8_t)((r->head + 1U) & (RING_SIZE - 1U));
    if (next == r->tail) {
        return 0;   /* full: drop the byte */
    }
    r->buf[r->head] = b;
    r->head = next;
    return 1;
}

int ring_get(ring_t *r, uint8_t *b)
{
    if (r->tail == r->head) {
        return 0;
    }
    *b = r->buf[r->tail];
    r->tail = (uint8_t)((r->tail + 1U) & (RING_SIZE - 1U));
    return 1;
}

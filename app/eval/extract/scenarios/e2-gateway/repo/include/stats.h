/*
 * stats.h - communication statistics
 */
#ifndef STATS_H
#define STATS_H

#include <stdint.h>

typedef struct {
    volatile uint64_t rx_frames;    /* frames seen on the bus, any address */
    volatile uint64_t rx_bytes;
    volatile uint32_t crc_errors;
    volatile uint32_t short_frames;
    volatile uint32_t rx_overruns;
    volatile uint32_t tx_timeouts;
    volatile uint32_t exceptions;
} stats_t;

extern stats_t g_stats;

void stats_clear(void);

#endif /* STATS_H */

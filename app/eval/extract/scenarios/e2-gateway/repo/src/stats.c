/*
 * stats.c - communication statistics
 *
 * Counters are incremented from the USART2 interrupt and the comm task and read by
 * the register map and the logger.
 */
#include <string.h>
#include "stats.h"
#include "picortos.h"

stats_t g_stats;

void stats_clear(void)
{
    uint32_t state = port_enter_critical();
    memset((void *)&g_stats, 0, sizeof(g_stats));
    port_exit_critical(state);
}

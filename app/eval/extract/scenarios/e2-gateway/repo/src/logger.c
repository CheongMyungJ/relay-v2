/*
 * logger.c - periodic data log to SPI flash (pro, devkit)
 */
#include "app.h"
#include "misc.h"
#include "sensor.h"
#include "stats.h"
#include "regs.h"

struct __attribute__((packed)) log_record {
    uint32_t uptime_s;
    uint64_t rx_frames;
    uint32_t crc_errors;
    int16_t value[SENSOR_MAX_CH];
};

void logger_task(void *arg)
{
    tick_t last = task_tick_count();
    struct log_record rec;
    (void)arg;

    for (;;) {
        task_delay_until(&last, pdMS_TO_TICKS(LOG_PERIOD_MS));
        rec.uptime_s = g_uptime_s;
        rec.rx_frames = g_stats.rx_frames;
        rec.crc_errors = g_stats.crc_errors;
        if (mutex_lock(g_sensor_mutex, pdMS_TO_TICKS(50U)) == pdPASS) {
            for (uint8_t ch = 0; ch < SENSOR_MAX_CH; ch++) {
                rec.value[ch] = g_sensor.value[ch];
            }
            mutex_unlock(g_sensor_mutex);
        }
        (void)spi_flash_append(&rec, sizeof(rec));
        wdog_alive(WDOG_LOGGER);
    }
}

/*
 * sensor.h - analog sensor acquisition
 */
#ifndef SENSOR_H
#define SENSOR_H

#include <stdint.h>

#define SENSOR_MAX_CH       4U
#define SENSOR_PERIOD_MS    25U     /* filter update period */
#define SENSOR_TIMEOUT_MS   200U    /* no DMA half-buffer for this long: sensor fault */

typedef struct {
    int16_t value[SENSOR_MAX_CH];   /* scaled, see regs.h */
    uint32_t sample_count;          /* DMA half-buffers since the last filter reset */
    uint8_t fault;
} sensor_data_t;

extern sensor_data_t g_sensor;      /* guarded by g_sensor_mutex */
extern volatile uint16_t g_avg_window;

void sensor_init(void);
void sensor_reset_filter(void);

#endif /* SENSOR_H */

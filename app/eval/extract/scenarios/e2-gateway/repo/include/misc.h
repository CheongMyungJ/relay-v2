/*
 * misc.h - timebase, watchdog, settings store, logger
 */
#ifndef MISC_H
#define MISC_H

#include <stdint.h>

/* ---- timebase (TIM7, 1 kHz) ---- */
extern volatile uint32_t g_ms;
void timebase_init(void);
uint32_t timebase_ms(void);

/* ---- watchdog ---- */
#define WDOG_COMM           (1U << 0)
#define WDOG_SENSOR         (1U << 1)
#define WDOG_LOGGER         (1U << 2)
#define WDOG_CHECK_MS       500U
void wdog_init(void);
void wdog_alive(uint32_t who);

/* ---- settings in flash sector 11 ---- */
typedef struct {
    uint8_t slave_addr;
    uint8_t baud_code;
    int16_t alarm_high;
    int16_t alarm_low;
    uint16_t avg_window;
} settings_t;

extern settings_t g_settings;
extern volatile uint8_t g_cfg_busy;
void config_load(void);
void config_request_save(void);
uint32_t config_baud(void);

/* ---- logger (pro, devkit) ---- */
#define LOG_PERIOD_MS       1000U
void spi_flash_init(void);
int spi_flash_append(const void *data, uint16_t len);

#endif /* MISC_H */

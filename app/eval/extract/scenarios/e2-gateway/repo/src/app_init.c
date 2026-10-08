/*
 * app_init.c - creates the kernel objects and tasks and registers Modbus functions
 */
#include "app.h"
#include "modbus.h"
#include "rs485.h"
#include "sensor.h"
#include "misc.h"

queue_t g_event_q;
mutex_t g_sensor_mutex;

static void register_functions(void)
{
    (void)mb_register(MB_FC_READ_HOLDING, mb_fc03_read_holding);
    (void)mb_register(MB_FC_WRITE_SINGLE, mb_fc06_write_single);
#if CFG_FEATURE_FC16
    (void)mb_register(MB_FC_WRITE_MULTIPLE, mb_fc16_write_multiple);
#endif
#if CFG_FEATURE_DEVICE_ID
    (void)mb_register(MB_FC_DEVICE_ID, mb_fc43_device_id);
#endif
#ifdef MB_DIAG_ENABLE
    (void)mb_register(MB_FC_DIAGNOSTICS, mb_fc08_diagnostics);
#endif
}

void app_init(void)
{
    g_event_q = queue_create(8U, sizeof(enum app_event));
    g_sensor_mutex = mutex_create();

    config_load();
    g_avg_window = g_settings.avg_window;

    mb_init(g_settings.slave_addr);
    register_functions();
    rs485_init(config_baud());
    sensor_init();
    wdog_init();
#if CFG_FEATURE_LOGGER
    spi_flash_init();
#endif

    (void)task_create(wdog_task, "wdog", STACK_WDOG, 0, PRIO_WDOG, 0);
    (void)task_create(mb_task, "comm", STACK_COMM, 0, PRIO_COMM, 0);
    (void)task_create(sensor_task, "sensor", STACK_SENSOR, 0, PRIO_SENSOR, 0);
    (void)task_create(cfg_task, "cfg", STACK_CFG, 0, PRIO_CFG, 0);
#if CFG_FEATURE_LOGGER
    (void)task_create(logger_task, "logger", STACK_LOGGER, 0, PRIO_LOGGER, 0);
#endif
#if defined(VARIANT_DEVKIT)
    console_init();
#endif
}

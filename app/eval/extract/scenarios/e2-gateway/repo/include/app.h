/*
 * app.h - tasks, queues and shared objects of the GW-400 application
 */
#ifndef APP_H
#define APP_H

#include <stdint.h>
#include "picortos.h"

/* task priorities (configMAX_PRIORITIES is 6; higher number runs first) */
#define PRIO_WDOG           4U
#define PRIO_COMM           3U
#define PRIO_SENSOR         2U
#define PRIO_CFG            1U
#define PRIO_LOGGER         1U

#define STACK_COMM          512U
#define STACK_SENSOR        384U
#define STACK_WDOG          256U
#define STACK_CFG           384U
#define STACK_LOGGER        512U

/* events posted by the timebase */
enum app_event { EV_SECOND = 1 };

extern queue_t g_event_q;       /* enum app_event, consumed by the watchdog task */
extern mutex_t g_sensor_mutex;  /* guards g_sensor */

void app_init(void);

void mb_task(void *arg);
void sensor_task(void *arg);
void wdog_task(void *arg);
void cfg_task(void *arg);
#if CFG_FEATURE_LOGGER
void logger_task(void *arg);
#endif
#if defined(VARIANT_DEVKIT)
void console_init(void);
#endif

#endif /* APP_H */

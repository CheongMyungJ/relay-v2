/*
 * timers.c - picoRTOS software timers
 *
 * picoRTOS 3.2.1, MIT license (see LICENSE).
 *
 * Software timers run their callbacks from the timer service task, never from an
 * interrupt. Periods are in ticks. The service task must be started with
 * rtos_timers_start() before rtos_start().
 */
#include "picortos.h"
#include "rtos_internal.h"

#ifndef configTIMER_TASK_PRIORITY
#define configTIMER_TASK_PRIORITY   (configMAX_PRIORITIES - 1U)
#endif

#ifndef configTIMER_QUEUE_LENGTH
#define configTIMER_QUEUE_LENGTH    8U
#endif

#ifndef configMAX_SOFT_TIMERS
#define configMAX_SOFT_TIMERS       8U
#endif

typedef void (*rtos_timer_fn)(void *arg);

struct rtos_timer {
    const char *name;
    tick_t period;
    tick_t expiry;
    uint8_t auto_reload;
    uint8_t active;
    rtos_timer_fn fn;
    void *arg;
};

enum timer_cmd_kind { TIMER_START, TIMER_STOP, TIMER_CHANGE_PERIOD };

struct timer_cmd {
    enum timer_cmd_kind kind;
    struct rtos_timer *timer;
    tick_t value;
};

static struct rtos_timer s_timers[configMAX_SOFT_TIMERS];
static uint8_t s_timer_count;
static queue_t s_cmd_q;

struct rtos_timer *rtos_timer_create(const char *name, tick_t period, int auto_reload,
                                     rtos_timer_fn fn, void *arg)
{
    if (s_timer_count >= configMAX_SOFT_TIMERS || period == 0U) {
        return 0;
    }
    struct rtos_timer *t = &s_timers[s_timer_count++];
    t->name = name;
    t->period = period;
    t->expiry = 0;
    t->auto_reload = (uint8_t)(auto_reload != 0);
    t->active = 0;
    t->fn = fn;
    t->arg = arg;
    return t;
}

static int post(enum timer_cmd_kind kind, struct rtos_timer *t, tick_t value, tick_t wait)
{
    struct timer_cmd c = { kind, t, value };
    return queue_send(s_cmd_q, &c, wait);
}

int rtos_timer_start(struct rtos_timer *t, tick_t wait)
{
    return post(TIMER_START, t, 0, wait);
}

int rtos_timer_stop(struct rtos_timer *t, tick_t wait)
{
    return post(TIMER_STOP, t, 0, wait);
}

int rtos_timer_change_period(struct rtos_timer *t, tick_t period, tick_t wait)
{
    if (period == 0U) {
        return pdFAIL;
    }
    return post(TIMER_CHANGE_PERIOD, t, period, wait);
}

static tick_t next_expiry(tick_t now, int *any)
{
    tick_t best = 0;
    *any = 0;
    for (uint8_t i = 0; i < s_timer_count; i++) {
        struct rtos_timer *t = &s_timers[i];
        if (!t->active) {
            continue;
        }
        tick_t left = (tick_t)(t->expiry - now);
        if ((int32_t)left < 0) {
            left = 0;
        }
        if (!*any || left < best) {
            best = left;
            *any = 1;
        }
    }
    return best;
}

static void process_command(const struct timer_cmd *c, tick_t now)
{
    struct rtos_timer *t = c->timer;
    switch (c->kind) {
    case TIMER_START:
        t->expiry = now + t->period;
        t->active = 1;
        break;
    case TIMER_STOP:
        t->active = 0;
        break;
    case TIMER_CHANGE_PERIOD:
        t->period = c->value;
        t->expiry = now + t->period;
        t->active = 1;
        break;
    }
}

static void fire_expired(tick_t now)
{
    for (uint8_t i = 0; i < s_timer_count; i++) {
        struct rtos_timer *t = &s_timers[i];
        if (!t->active || (int32_t)(now - t->expiry) < 0) {
            continue;
        }
        if (t->auto_reload) {
            /* keep the phase: the next expiry is relative to the previous one */
            t->expiry += t->period;
            if ((int32_t)(now - t->expiry) >= 0) {
                t->expiry = now + t->period;
            }
        } else {
            t->active = 0;
        }
        t->fn(t->arg);
    }
}

static void timer_service_task(void *arg)
{
    (void)arg;
    for (;;) {
        int any;
        tick_t now = task_tick_count();
        tick_t wait = next_expiry(now, &any);
        struct timer_cmd c;
        if (queue_receive(s_cmd_q, &c, any ? wait : portMAX_DELAY) == pdPASS) {
            process_command(&c, task_tick_count());
        }
        fire_expired(task_tick_count());
    }
}

int rtos_timers_start(void)
{
    s_cmd_q = queue_create(configTIMER_QUEUE_LENGTH, sizeof(struct timer_cmd));
    if (s_cmd_q == 0) {
        return pdFAIL;
    }
    return task_create(timer_service_task, "tmr", 256U, 0, configTIMER_TASK_PRIORITY, 0);
}

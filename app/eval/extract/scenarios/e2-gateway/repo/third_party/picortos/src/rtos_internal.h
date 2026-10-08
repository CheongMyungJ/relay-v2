/*
 * rtos_internal.h - picoRTOS internal declarations
 *
 * picoRTOS 3.2.1, MIT license (see LICENSE).
 */
#ifndef RTOS_INTERNAL_H
#define RTOS_INTERNAL_H

#include "picortos.h"

enum task_state { TASK_READY, TASK_BLOCKED };

struct rtos_task {
    uint32_t *sp;               /* must stay the first member: the port saves it here */
    uint32_t *stack_base;
    uint16_t stack_words;
    uint8_t priority;
    uint8_t timed_out;
    enum task_state state;
    tick_t wake_tick;
    const char *name;
    struct rtos_task *next;         /* ready list */
    struct rtos_task *wait_next;    /* wait list of a queue */
    struct rtos_task *delay_next;   /* delayed list */
    struct rtos_task **wait_list;
};

struct rtos_queue {
    uint8_t *storage;
    uint16_t length;
    uint16_t item_size;
    uint16_t count;
    uint16_t head;
    uint16_t tail;
    uint8_t is_mutex;
    struct rtos_task *owner;
    struct rtos_task *waiting_send;
    struct rtos_task *waiting_receive;
};

extern struct rtos_task *volatile g_rtos_current;

void *rtos_alloc_words(uint32_t words);
void rtos_make_ready(struct rtos_task *t);
void rtos_block_current(tick_t timeout, struct rtos_task **wait_list);
int rtos_wake_first(struct rtos_task **wait_list);
void rtos_switch_context(void);
int rtos_tick(void);
uint32_t *port_init_stack(uint32_t *top, task_fn fn, void *arg);

#endif /* RTOS_INTERNAL_H */

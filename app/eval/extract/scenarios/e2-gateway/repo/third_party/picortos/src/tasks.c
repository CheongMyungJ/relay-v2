/*
 * tasks.c - picoRTOS scheduler and task management
 *
 * picoRTOS 3.2.1, MIT license (see LICENSE).
 *
 * Fixed-priority preemptive scheduler. Tasks of equal priority are scheduled
 * round-robin on every tick. Task control blocks and stacks come from a static pool.
 */
#include "picortos.h"
#include "rtos_internal.h"

#ifndef configTOTAL_HEAP_WORDS
#define configTOTAL_HEAP_WORDS  4096U
#endif

#ifndef configMAX_TASKS
#define configMAX_TASKS         8U
#endif

#define STACK_FILL              0xA5A5A5A5UL

static uint32_t s_heap[configTOTAL_HEAP_WORDS];
static uint32_t s_heap_next;

static struct rtos_task s_tasks[configMAX_TASKS + 1U];
static uint8_t s_task_count;
static struct rtos_task *s_ready[configMAX_PRIORITIES];
static struct rtos_task *s_delayed;
static struct rtos_task *s_idle;

struct rtos_task *volatile g_rtos_current;
static volatile tick_t s_ticks;
static volatile uint8_t s_running;

void *rtos_alloc_words(uint32_t words)
{
    uint32_t state = port_enter_critical();
    void *p = 0;
    if (s_heap_next + words <= configTOTAL_HEAP_WORDS) {
        p = &s_heap[s_heap_next];
        s_heap_next += words;
    }
    port_exit_critical(state);
    configASSERT(p != 0);
    return p;
}

static void list_push(struct rtos_task **head, struct rtos_task *t)
{
    t->next = 0;
    if (*head == 0) {
        *head = t;
        return;
    }
    struct rtos_task *it = *head;
    while (it->next != 0) {
        it = it->next;
    }
    it->next = t;
}

static void list_remove(struct rtos_task **head, struct rtos_task *t)
{
    struct rtos_task **pp = head;
    while (*pp != 0) {
        if (*pp == t) {
            *pp = t->next;
            t->next = 0;
            return;
        }
        pp = &(*pp)->next;
    }
}

void rtos_make_ready(struct rtos_task *t)
{
    t->state = TASK_READY;
    list_push(&s_ready[t->priority], t);
}

void rtos_block_current(tick_t timeout, struct rtos_task **wait_list)
{
    struct rtos_task *t = g_rtos_current;

    list_remove(&s_ready[t->priority], t);
    t->state = TASK_BLOCKED;
    t->wait_list = wait_list;
    if (wait_list != 0) {
        struct rtos_task **pp = wait_list;
        while (*pp != 0 && (*pp)->priority >= t->priority) {
            pp = &(*pp)->wait_next;
        }
        t->wait_next = *pp;
        *pp = t;
    }
    if (timeout != portMAX_DELAY) {
        t->wake_tick = s_ticks + timeout;
        t->delay_next = s_delayed;
        s_delayed = t;
    } else {
        t->wake_tick = 0;
    }
}

static void unlink_delayed(struct rtos_task *t)
{
    struct rtos_task **pp = &s_delayed;
    while (*pp != 0) {
        if (*pp == t) {
            *pp = t->delay_next;
            t->delay_next = 0;
            return;
        }
        pp = &(*pp)->delay_next;
    }
}

int rtos_wake_first(struct rtos_task **wait_list)
{
    struct rtos_task *t = *wait_list;
    if (t == 0) {
        return 0;
    }
    *wait_list = t->wait_next;
    t->wait_next = 0;
    t->wait_list = 0;
    t->timed_out = 0;
    unlink_delayed(t);
    rtos_make_ready(t);
    return t->priority > g_rtos_current->priority;
}

static void idle_task(void *arg)
{
    (void)arg;
    for (;;) {
        rtos_idle_hook();
    }
}

__attribute__((weak)) void rtos_idle_hook(void)
{
}

__attribute__((weak)) void rtos_tick_hook(void)
{
}

__attribute__((weak)) void rtos_stack_overflow_hook(task_t t)
{
    (void)t;
    for (;;) {
    }
}

void rtos_init(void)
{
    s_heap_next = 0;
    s_task_count = 0;
    s_delayed = 0;
    for (uint32_t i = 0; i < configMAX_PRIORITIES; i++) {
        s_ready[i] = 0;
    }
    (void)task_create(idle_task, "idle", 64U, 0, 0U, &s_idle);
}

int task_create(task_fn fn, const char *name, uint16_t stack_words, void *arg,
                uint8_t priority, task_t *out)
{
    if (s_task_count > configMAX_TASKS || priority >= configMAX_PRIORITIES) {
        return pdFAIL;
    }
    struct rtos_task *t = &s_tasks[s_task_count++];
    uint32_t *stack = rtos_alloc_words(stack_words);
    if (stack == 0) {
        return pdFAIL;
    }
    for (uint32_t i = 0; i < stack_words; i++) {
        stack[i] = STACK_FILL;
    }
    t->stack_base = stack;
    t->stack_words = stack_words;
    t->sp = port_init_stack(stack + stack_words, fn, arg);
    t->priority = priority;
    t->name = name;
    t->next = 0;
    t->wait_next = 0;
    t->delay_next = 0;
    t->wait_list = 0;
    rtos_make_ready(t);
    if (out != 0) {
        *out = t;
    }
    return pdPASS;
}

static struct rtos_task *highest_ready(void)
{
    for (int p = (int)configMAX_PRIORITIES - 1; p >= 0; p--) {
        if (s_ready[p] != 0) {
            return s_ready[p];
        }
    }
    return s_idle;
}

/* called from PendSV with interrupts masked up to configMAX_SYSCALL_INTERRUPT_PRIORITY */
void rtos_switch_context(void)
{
    struct rtos_task *cur = g_rtos_current;
    if (cur != 0 && cur->stack_base[0] != STACK_FILL) {
        rtos_stack_overflow_hook(cur);
    }
    struct rtos_task *next = highest_ready();
    if (next == cur && next->next != 0) {
        /* round robin among equal priorities */
        list_remove(&s_ready[next->priority], next);
        list_push(&s_ready[next->priority], next);
        next = s_ready[next->priority];
    }
    g_rtos_current = next;
}

/* called from the tick interrupt */
int rtos_tick(void)
{
    int switch_needed = 0;

    s_ticks++;
    rtos_tick_hook();
    struct rtos_task **pp = &s_delayed;
    while (*pp != 0) {
        struct rtos_task *t = *pp;
        if ((int32_t)(s_ticks - t->wake_tick) >= 0) {
            *pp = t->delay_next;
            t->delay_next = 0;
            if (t->wait_list != 0) {
                struct rtos_task **wp = t->wait_list;
                while (*wp != 0 && *wp != t) {
                    wp = &(*wp)->wait_next;
                }
                if (*wp == t) {
                    *wp = t->wait_next;
                }
                t->wait_list = 0;
                t->timed_out = 1;
            }
            rtos_make_ready(t);
            if (t->priority >= g_rtos_current->priority) {
                switch_needed = 1;
            }
        } else {
            pp = &t->delay_next;
        }
    }
    if (s_ready[g_rtos_current->priority] != 0 && s_ready[g_rtos_current->priority]->next != 0) {
        switch_needed = 1;
    }
    return switch_needed;
}

void rtos_start(void)
{
    g_rtos_current = highest_ready();
    s_running = 1;
    port_setup_tick();
    port_start_first_task();
}

int rtos_is_running(void)
{
    return s_running;
}

void task_delay(tick_t ticks)
{
    if (ticks == 0U) {
        task_yield();
        return;
    }
    uint32_t state = port_enter_critical();
    rtos_block_current(ticks, 0);
    port_exit_critical(state);
    port_yield();
}

void task_delay_until(tick_t *previous_wake, tick_t period)
{
    uint32_t state = port_enter_critical();
    tick_t next = *previous_wake + period;
    tick_t now = s_ticks;
    *previous_wake = next;
    if ((int32_t)(next - now) > 0) {
        rtos_block_current(next - now, 0);
        port_exit_critical(state);
        port_yield();
        return;
    }
    port_exit_critical(state);
}

tick_t task_tick_count(void)
{
    return s_ticks;
}

tick_t task_tick_count_from_isr(void)
{
    return s_ticks;
}

void task_yield(void)
{
    port_yield();
}

const char *task_name(task_t t)
{
    return t->name;
}

task_t task_current(void)
{
    return g_rtos_current;
}

#if configASSERT_ENABLED
void rtos_assert_failed(const char *file, int line)
{
    (void)file;
    (void)line;
    (void)port_enter_critical();
    for (;;) {
    }
}
#endif

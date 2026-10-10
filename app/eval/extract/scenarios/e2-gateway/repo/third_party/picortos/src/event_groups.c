/*
 * event_groups.c - picoRTOS event groups
 *
 * picoRTOS 3.2.1, MIT license (see LICENSE).
 *
 * An event group holds 24 flag bits. Tasks wait for any or all of a set of bits;
 * interrupts may set bits with event_group_set_from_isr (same priority rule as the
 * other *_from_isr functions, see queue.c).
 */
#include "picortos.h"
#include "rtos_internal.h"

#define EVENT_BITS_MASK     0x00FFFFFFUL

struct rtos_event_group {
    uint32_t bits;
    struct rtos_task *waiting;
    uint32_t wait_bits[configMAX_TASKS + 1U];
    uint8_t wait_all[configMAX_TASKS + 1U];
    struct rtos_task *wait_task[configMAX_TASKS + 1U];
    uint8_t wait_count;
};

typedef struct rtos_event_group *event_group_t;

event_group_t event_group_create(void)
{
    event_group_t g = rtos_alloc_words((sizeof(struct rtos_event_group) + 3U) / 4U);
    if (g != 0) {
        g->bits = 0;
        g->waiting = 0;
        g->wait_count = 0;
    }
    return g;
}

static int satisfied(uint32_t bits, uint32_t want, uint8_t all)
{
    return all ? ((bits & want) == want) : ((bits & want) != 0U);
}

static int release_waiters(event_group_t g)
{
    int yield = 0;
    uint8_t i = 0;
    while (i < g->wait_count) {
        if (satisfied(g->bits, g->wait_bits[i], g->wait_all[i])) {
            struct rtos_task *t = g->wait_task[i];
            g->wait_count--;
            g->wait_task[i] = g->wait_task[g->wait_count];
            g->wait_bits[i] = g->wait_bits[g->wait_count];
            g->wait_all[i] = g->wait_all[g->wait_count];
            struct rtos_task **list = &g->waiting;
            while (*list != 0 && *list != t) {
                list = &(*list)->wait_next;
            }
            if (*list == t) {
                *list = t->wait_next;
                t->wait_next = 0;
            }
            t->wait_list = 0;
            t->timed_out = 0;
            rtos_make_ready(t);
            if (t->priority > g_rtos_current->priority) {
                yield = 1;
            }
        } else {
            i++;
        }
    }
    return yield;
}

uint32_t event_group_set(event_group_t g, uint32_t bits)
{
    uint32_t state = port_enter_critical();
    g->bits |= bits & EVENT_BITS_MASK;
    int yield = release_waiters(g);
    uint32_t now = g->bits;
    port_exit_critical(state);
    if (yield) {
        port_yield();
    }
    return now;
}

uint32_t event_group_set_from_isr(event_group_t g, uint32_t bits, int *higher_priority_woken)
{
    uint32_t state = port_enter_critical();
    g->bits |= bits & EVENT_BITS_MASK;
    if (release_waiters(g) && higher_priority_woken != 0) {
        *higher_priority_woken = pdTRUE;
    }
    uint32_t now = g->bits;
    port_exit_critical(state);
    return now;
}

uint32_t event_group_clear(event_group_t g, uint32_t bits)
{
    uint32_t state = port_enter_critical();
    uint32_t before = g->bits;
    g->bits &= ~(bits & EVENT_BITS_MASK);
    port_exit_critical(state);
    return before;
}

uint32_t event_group_wait(event_group_t g, uint32_t bits, int clear_on_exit, int wait_all, tick_t timeout)
{
    uint32_t state = port_enter_critical();
    if (satisfied(g->bits, bits, (uint8_t)wait_all)) {
        uint32_t now = g->bits;
        if (clear_on_exit) {
            g->bits &= ~bits;
        }
        port_exit_critical(state);
        return now;
    }
    if (timeout == 0U || g->wait_count > configMAX_TASKS) {
        uint32_t now = g->bits;
        port_exit_critical(state);
        return now;
    }
    g->wait_task[g->wait_count] = g_rtos_current;
    g->wait_bits[g->wait_count] = bits;
    g->wait_all[g->wait_count] = (uint8_t)wait_all;
    g->wait_count++;
    rtos_block_current(timeout, &g->waiting);
    port_exit_critical(state);
    port_yield();

    state = port_enter_critical();
    uint32_t now = g->bits;
    if (!g_rtos_current->timed_out && clear_on_exit) {
        g->bits &= ~bits;
    }
    if (g_rtos_current->timed_out) {
        for (uint8_t i = 0; i < g->wait_count; i++) {
            if (g->wait_task[i] == g_rtos_current) {
                g->wait_count--;
                g->wait_task[i] = g->wait_task[g->wait_count];
                g->wait_bits[i] = g->wait_bits[g->wait_count];
                g->wait_all[i] = g->wait_all[g->wait_count];
                break;
            }
        }
    }
    port_exit_critical(state);
    return now;
}

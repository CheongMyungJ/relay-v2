/*
 * queue.c - picoRTOS queues, binary semaphores and mutexes
 *
 * picoRTOS 3.2.1, MIT license (see LICENSE).
 *
 * The *_from_isr functions may only be called from interrupts whose priority is
 * numerically greater than or equal to configMAX_SYSCALL_INTERRUPT_PRIORITY (that is,
 * logically lower or equal). Calling them from a more urgent interrupt corrupts the
 * kernel lists because the kernel critical section does not mask that interrupt.
 */
#include <string.h>
#include "picortos.h"
#include "rtos_internal.h"

queue_t queue_create(uint16_t length, uint16_t item_size)
{
    uint32_t bytes = (uint32_t)length * item_size;
    struct rtos_queue *q = rtos_alloc_words((sizeof(struct rtos_queue) + 3U) / 4U);
    if (q == 0) {
        return 0;
    }
    q->storage = (bytes != 0U) ? rtos_alloc_words((bytes + 3U) / 4U) : 0;
    q->length = length;
    q->item_size = item_size;
    q->count = 0;
    q->head = 0;
    q->tail = 0;
    q->is_mutex = 0;
    q->owner = 0;
    q->waiting_send = 0;
    q->waiting_receive = 0;
    return q;
}

static void copy_in(struct rtos_queue *q, const void *item)
{
    if (q->item_size != 0U) {
        memcpy(&q->storage[(uint32_t)q->tail * q->item_size], item, q->item_size);
        q->tail = (uint16_t)((q->tail + 1U) % q->length);
    }
    q->count++;
}

static void copy_out(struct rtos_queue *q, void *item)
{
    if (q->item_size != 0U) {
        memcpy(item, &q->storage[(uint32_t)q->head * q->item_size], q->item_size);
        q->head = (uint16_t)((q->head + 1U) % q->length);
    }
    q->count--;
}

int queue_send(queue_t q, const void *item, tick_t timeout)
{
    for (;;) {
        uint32_t state = port_enter_critical();
        if (q->count < q->length) {
            copy_in(q, item);
            int yield = rtos_wake_first(&q->waiting_receive);
            port_exit_critical(state);
            if (yield) {
                port_yield();
            }
            return pdPASS;
        }
        if (timeout == 0U) {
            port_exit_critical(state);
            return pdFAIL;
        }
        g_rtos_current->timed_out = 0;
        rtos_block_current(timeout, &q->waiting_send);
        port_exit_critical(state);
        port_yield();
        if (g_rtos_current->timed_out) {
            return pdFAIL;
        }
    }
}

int queue_receive(queue_t q, void *item, tick_t timeout)
{
    for (;;) {
        uint32_t state = port_enter_critical();
        if (q->count > 0U) {
            copy_out(q, item);
            int yield = rtos_wake_first(&q->waiting_send);
            port_exit_critical(state);
            if (yield) {
                port_yield();
            }
            return pdPASS;
        }
        if (timeout == 0U) {
            port_exit_critical(state);
            return pdFAIL;
        }
        g_rtos_current->timed_out = 0;
        rtos_block_current(timeout, &q->waiting_receive);
        port_exit_critical(state);
        port_yield();
        if (g_rtos_current->timed_out) {
            return pdFAIL;
        }
    }
}

int queue_send_from_isr(queue_t q, const void *item, int *higher_priority_woken)
{
    uint32_t state = port_enter_critical();
    int ok = pdFAIL;
    if (q->count < q->length) {
        copy_in(q, item);
        if (rtos_wake_first(&q->waiting_receive) && higher_priority_woken != 0) {
            *higher_priority_woken = pdTRUE;
        }
        ok = pdPASS;
    }
    port_exit_critical(state);
    return ok;
}

uint16_t queue_waiting(queue_t q)
{
    return q->count;
}

sem_t sem_create_binary(void)
{
    return queue_create(1U, 0U);
}

int sem_take(sem_t s, tick_t timeout)
{
    return queue_receive(s, 0, timeout);
}

void sem_give(sem_t s)
{
    (void)queue_send(s, 0, 0U);
}

void sem_give_from_isr(sem_t s, int *higher_priority_woken)
{
    (void)queue_send_from_isr(s, 0, higher_priority_woken);
}

mutex_t mutex_create(void)
{
    mutex_t m = queue_create(1U, 0U);
    if (m != 0) {
        m->is_mutex = 1;
        m->count = 1;
    }
    return m;
}

int mutex_lock(mutex_t m, tick_t timeout)
{
    configASSERT(m->is_mutex);
    int ok = queue_receive(m, 0, timeout);
    if (ok == pdPASS) {
        m->owner = g_rtos_current;
    }
    return ok;
}

void mutex_unlock(mutex_t m)
{
    configASSERT(m->owner == g_rtos_current);
    m->owner = 0;
    (void)queue_send(m, 0, 0U);
}

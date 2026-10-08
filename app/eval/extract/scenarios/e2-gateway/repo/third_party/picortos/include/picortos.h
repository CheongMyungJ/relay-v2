/*
 * picortos.h - picoRTOS public API
 *
 * picoRTOS 3.2.1, MIT license (see LICENSE).
 *
 * The application provides picortos_config.h with:
 *   configTICK_RATE_HZ, configMAX_PRIORITIES, configMAX_SYSCALL_INTERRUPT_PRIORITY,
 *   configCPU_CLOCK_HZ, configASSERT_ENABLED, configTOTAL_HEAP_WORDS
 */
#ifndef PICORTOS_H
#define PICORTOS_H

#include <stdint.h>
#include <stddef.h>
#include "picortos_config.h"

#ifndef configASSERT_ENABLED
#define configASSERT_ENABLED 0
#endif

typedef uint32_t tick_t;
typedef void (*task_fn)(void *arg);

typedef struct rtos_task *task_t;
typedef struct rtos_queue *queue_t;
typedef struct rtos_queue *sem_t;
typedef struct rtos_queue *mutex_t;

#define portMAX_DELAY       ((tick_t)0xFFFFFFFFUL)
#define pdTRUE              1
#define pdFALSE             0
#define pdPASS              1
#define pdFAIL              0

/* Converts milliseconds to ticks. Truncates: the result is never longer than ms. */
#define pdMS_TO_TICKS(ms)   ((tick_t)(((uint32_t)(ms) * (uint32_t)configTICK_RATE_HZ) / 1000UL))
#define pdTICKS_TO_MS(t)    ((uint32_t)(((uint32_t)(t) * 1000UL) / (uint32_t)configTICK_RATE_HZ))

#if configASSERT_ENABLED
void rtos_assert_failed(const char *file, int line);
#define configASSERT(x) do { if (!(x)) { rtos_assert_failed(__FILE__, __LINE__); } } while (0)
#else
#define configASSERT(x) ((void)0)
#endif

/* ---- scheduler ---- */
void rtos_init(void);
void rtos_start(void);
int rtos_is_running(void);

/* ---- tasks ---- */
int task_create(task_fn fn, const char *name, uint16_t stack_words, void *arg,
                uint8_t priority, task_t *out);
void task_delay(tick_t ticks);
void task_delay_until(tick_t *previous_wake, tick_t period);
tick_t task_tick_count(void);
tick_t task_tick_count_from_isr(void);
void task_yield(void);
const char *task_name(task_t t);
task_t task_current(void);

/* ---- queues ---- */
queue_t queue_create(uint16_t length, uint16_t item_size);
int queue_send(queue_t q, const void *item, tick_t timeout);
int queue_receive(queue_t q, void *item, tick_t timeout);
int queue_send_from_isr(queue_t q, const void *item, int *higher_priority_woken);
uint16_t queue_waiting(queue_t q);

/* ---- semaphores and mutexes (built on queues) ---- */
sem_t sem_create_binary(void);
int sem_take(sem_t s, tick_t timeout);
void sem_give(sem_t s);
void sem_give_from_isr(sem_t s, int *higher_priority_woken);
mutex_t mutex_create(void);
int mutex_lock(mutex_t m, tick_t timeout);
void mutex_unlock(mutex_t m);

/* ---- port layer ---- */
uint32_t port_enter_critical(void);
void port_exit_critical(uint32_t state);
void port_yield(void);
void port_yield_from_isr(int higher_priority_woken);
void port_start_first_task(void);
void port_setup_tick(void);

/* ---- hooks (weak, the application may override) ---- */
void rtos_idle_hook(void);
void rtos_tick_hook(void);
void rtos_stack_overflow_hook(task_t t);

#endif /* PICORTOS_H */

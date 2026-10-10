/*
 * port.c - picoRTOS port for ARM Cortex-M4 (no FPU context)
 *
 * picoRTOS 3.2.1, MIT license (see LICENSE).
 *
 * Critical sections raise BASEPRI to configMAX_SYSCALL_INTERRUPT_PRIORITY, so
 * interrupts with a numerically lower priority value (more urgent) are never masked
 * by the kernel. The tick is driven by SysTick at configTICK_RATE_HZ and context
 * switches happen in PendSV at the lowest priority.
 */
#include <stdint.h>
#include "picortos.h"
#include "../../src/rtos_internal.h"

#define NVIC_PRIO_BITS          4U
#define SCB_ICSR                (*(volatile uint32_t *)0xE000ED04UL)
#define SCB_SHPR3               (*(volatile uint32_t *)0xE000ED20UL)
#define SYST_CSR                (*(volatile uint32_t *)0xE000E010UL)
#define SYST_RVR                (*(volatile uint32_t *)0xE000E014UL)
#define SYST_CVR                (*(volatile uint32_t *)0xE000E018UL)
#define ICSR_PENDSVSET          (1UL << 28)
#define INITIAL_XPSR            0x01000000UL
#define BASEPRI_SYSCALL         ((uint32_t)configMAX_SYSCALL_INTERRUPT_PRIORITY << (8U - NVIC_PRIO_BITS))

static void task_exit_error(void)
{
    configASSERT(0);
    for (;;) {
    }
}

uint32_t *port_init_stack(uint32_t *top, task_fn fn, void *arg)
{
    uint32_t *sp = top;
    *--sp = INITIAL_XPSR;                   /* xPSR */
    *--sp = (uint32_t)fn & ~1UL;            /* PC */
    *--sp = (uint32_t)task_exit_error;      /* LR */
    sp -= 4;                                /* R12, R3, R2, R1 */
    *--sp = (uint32_t)arg;                  /* R0 */
    sp -= 8;                                /* R11..R4 */
    return sp;
}

uint32_t port_enter_critical(void)
{
    uint32_t old;
    uint32_t newval = BASEPRI_SYSCALL;
    __asm volatile ("mrs %0, basepri\n msr basepri, %1\n dsb\n isb" : "=&r"(old) : "r"(newval) : "memory");
    return old;
}

void port_exit_critical(uint32_t state)
{
    __asm volatile ("msr basepri, %0" :: "r"(state) : "memory");
}

void port_yield(void)
{
    SCB_ICSR = ICSR_PENDSVSET;
    __asm volatile ("dsb\n isb" ::: "memory");
}

void port_yield_from_isr(int higher_priority_woken)
{
    if (higher_priority_woken) {
        SCB_ICSR = ICSR_PENDSVSET;
    }
}

void port_setup_tick(void)
{
    /* PendSV and SysTick at the lowest priority */
    SCB_SHPR3 |= (0xFFUL << 16) | (0xFFUL << 24);
    SYST_RVR = (configCPU_CLOCK_HZ / configTICK_RATE_HZ) - 1UL;
    SYST_CVR = 0;
    SYST_CSR = 0x07UL;  /* processor clock, interrupt, enable */
}

void SysTick_Handler(void)
{
    uint32_t state = port_enter_critical();
    if (rtos_tick()) {
        SCB_ICSR = ICSR_PENDSVSET;
    }
    port_exit_critical(state);
}

__attribute__((naked)) void PendSV_Handler(void)
{
    __asm volatile (
        "   mrs r0, psp                 \n"
        "   isb                         \n"
        "   ldr r3, =g_rtos_current     \n"
        "   ldr r2, [r3]                \n"
        "   stmdb r0!, {r4-r11}         \n"
        "   str r0, [r2]                \n"
        "   stmdb sp!, {r3, lr}         \n"
        "   mov r0, %0                  \n"
        "   msr basepri, r0             \n"
        "   dsb                         \n"
        "   isb                         \n"
        "   bl rtos_switch_context      \n"
        "   mov r0, #0                  \n"
        "   msr basepri, r0             \n"
        "   ldmia sp!, {r3, lr}         \n"
        "   ldr r1, [r3]                \n"
        "   ldr r0, [r1]                \n"
        "   ldmia r0!, {r4-r11}         \n"
        "   msr psp, r0                 \n"
        "   isb                         \n"
        "   bx lr                       \n"
        :: "i"(BASEPRI_SYSCALL)
    );
}

__attribute__((naked)) void SVC_Handler(void)
{
    __asm volatile (
        "   ldr r3, =g_rtos_current     \n"
        "   ldr r1, [r3]                \n"
        "   ldr r0, [r1]                \n"
        "   ldmia r0!, {r4-r11}         \n"
        "   msr psp, r0                 \n"
        "   isb                         \n"
        "   mov r0, #0                  \n"
        "   msr basepri, r0             \n"
        "   orr lr, lr, #0xd            \n"
        "   bx lr                       \n"
    );
}

void port_start_first_task(void)
{
    __asm volatile (
        "   cpsie i                     \n"
        "   dsb                         \n"
        "   isb                         \n"
        "   svc 0                       \n"
    );
    for (;;) {
    }
}

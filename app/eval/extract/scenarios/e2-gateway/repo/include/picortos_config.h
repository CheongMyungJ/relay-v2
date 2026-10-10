/*
 * picortos_config.h - kernel configuration for the GW-400 application
 */
#ifndef PICORTOS_CONFIG_H
#define PICORTOS_CONFIG_H

#define configCPU_CLOCK_HZ                  CFG_CPU_HZ
#define configTICK_RATE_HZ                  CFG_RTOS_TICK_HZ
#define configMAX_PRIORITIES                6U
#define configMAX_TASKS                     8U
#define configTOTAL_HEAP_WORDS              6144U

/*
 * Interrupts that call *_from_isr kernel functions must have a priority value of
 * at least this (0 is the most urgent on the N4, 15 the least).
 */
#define configMAX_SYSCALL_INTERRUPT_PRIORITY    5U

#if defined(VARIANT_DEVKIT)
#define configASSERT_ENABLED                1
#endif

#endif /* PICORTOS_CONFIG_H */

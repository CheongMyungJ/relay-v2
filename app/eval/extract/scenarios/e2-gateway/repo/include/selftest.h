/*
 * selftest.h - power-on self test and reset cause
 */
#ifndef SELFTEST_H
#define SELFTEST_H

#include <stdint.h>

#define SELFTEST_RAM        (1UL << 0)
#define SELFTEST_FLASH      (1UL << 1)

#define RESET_UNKNOWN       0U
#define RESET_POWER_ON      1U
#define RESET_PIN           2U
#define RESET_SOFTWARE      3U
#define RESET_WATCHDOG      4U

extern uint32_t g_selftest;
extern uint8_t g_reset_cause;

void selftest_run(void);
void selftest_blink(void);

#endif /* SELFTEST_H */

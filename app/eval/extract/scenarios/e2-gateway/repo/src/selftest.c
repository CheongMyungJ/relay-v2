/*
 * selftest.c - power-on self test and reset cause
 *
 * Runs once from board start-up before the kernel starts. Failures are latched in
 * g_selftest and reported through the status LED blink code; the firmware still
 * starts so that the Modbus interface stays reachable for service.
 */
#include <stdint.h>
#include "selftest.h"
#include "board.h"

#define RAM_TEST_WORDS      64U
#define FLASH_IMAGE_START   0x08000000UL
#define FLASH_IMAGE_WORDS   (64UL * 1024UL / 4UL)   /* first 64 KB: vectors and code */

uint32_t g_selftest;
uint8_t g_reset_cause;

static uint32_t s_ram_probe[RAM_TEST_WORDS];

static int ram_test(void)
{
    static const uint32_t patterns[4] = { 0x00000000UL, 0xFFFFFFFFUL, 0xAAAAAAAAUL, 0x55555555UL };
    for (uint32_t p = 0; p < 4U; p++) {
        volatile uint32_t *m = s_ram_probe;
        for (uint32_t i = 0; i < RAM_TEST_WORDS; i++) {
            m[i] = patterns[p] ^ i;
        }
        for (uint32_t i = 0; i < RAM_TEST_WORDS; i++) {
            if (m[i] != (patterns[p] ^ i)) {
                return -1;
            }
        }
    }
    return 0;
}

/* additive checksum over the start of the image; only detects gross corruption */
static uint32_t flash_sum(void)
{
    const volatile uint32_t *w = (const volatile uint32_t *)FLASH_IMAGE_START;
    uint32_t sum = 0;
    for (uint32_t i = 0; i < FLASH_IMAGE_WORDS; i++) {
        sum += w[i];
    }
    return sum;
}

static void read_reset_cause(void)
{
    uint32_t csr = RCC->CSR;
    if (csr & RCC_CSR_IWDGRSTF) {
        g_reset_cause = RESET_WATCHDOG;
    } else if (csr & (1UL << 26)) {
        g_reset_cause = RESET_PIN;
    } else if (csr & (1UL << 27)) {
        g_reset_cause = RESET_POWER_ON;
    } else if (csr & (1UL << 28)) {
        g_reset_cause = RESET_SOFTWARE;
    } else {
        g_reset_cause = RESET_UNKNOWN;
    }
    RCC->CSR |= RCC_CSR_RMVF;
}

void selftest_run(void)
{
    g_selftest = 0;
    read_reset_cause();
    if (ram_test() != 0) {
        g_selftest |= SELFTEST_RAM;
    }
    if (flash_sum() == 0U) {
        g_selftest |= SELFTEST_FLASH;
    }
}

void selftest_blink(void)
{
    /* one long blink, then one short blink per failed bit position */
    if (g_selftest == 0U) {
        return;
    }
    for (uint32_t bit = 0; bit < 8U; bit++) {
        if (g_selftest & (1UL << bit)) {
            board_led(1);
            for (volatile uint32_t d = 0; d < 400000UL; d++) {
            }
            board_led(0);
            for (volatile uint32_t d = 0; d < 400000UL; d++) {
            }
        }
    }
}

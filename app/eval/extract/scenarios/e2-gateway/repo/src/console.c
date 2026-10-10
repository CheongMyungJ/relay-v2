/*
 * console.c - debug console on USART1, 115200 8N1 (devkit only)
 *
 * Polled from its own task. Commands:
 *   stats            communication counters
 *   reg <addr>       read a holding register (hex address)
 *   set <addr> <v>   write a holding register (bypasses Modbus)
 *   tick             RTOS tick count and the timebase millisecond counter
 *   assert           trigger a kernel assertion (tests the watchdog path)
 */
#include <string.h>
#include "board.h"
#include "app.h"
#include "stats.h"
#include "regs.h"
#include "misc.h"

#define CONSOLE_BAUD        115200UL
#define LINE_MAX            48U
#define PRIO_CONSOLE        1U

static char s_line[LINE_MAX];
static uint8_t s_len;

static void put(char c)
{
    while ((USART1->SR & USART_SR_TXE) == 0U) {
    }
    USART1->DR = (uint8_t)c;
}

static void puts_(const char *s)
{
    while (*s) {
        put(*s++);
    }
}

static void put_u32(uint32_t v)
{
    char buf[11];
    int i = 10;
    buf[i] = '\0';
    do {
        buf[--i] = (char)('0' + (v % 10U));
        v /= 10U;
    } while (v != 0U && i > 0);
    puts_(&buf[i]);
}

static uint32_t parse_hex(const char *s, const char **end)
{
    uint32_t v = 0;
    while (*s == ' ') {
        s++;
    }
    for (;;) {
        char c = *s;
        uint32_t d;
        if (c >= '0' && c <= '9') {
            d = (uint32_t)(c - '0');
        } else if (c >= 'a' && c <= 'f') {
            d = (uint32_t)(c - 'a' + 10);
        } else if (c >= 'A' && c <= 'F') {
            d = (uint32_t)(c - 'A' + 10);
        } else {
            break;
        }
        v = (v << 4) | d;
        s++;
    }
    *end = s;
    return v;
}

static void cmd(const char *line)
{
    const char *p;
    if (strcmp(line, "stats") == 0) {
        puts_("frames ");
        put_u32((uint32_t)g_stats.rx_frames);
        puts_(" crc ");
        put_u32(g_stats.crc_errors);
        puts_(" short ");
        put_u32(g_stats.short_frames);
        puts_(" ovr ");
        put_u32(g_stats.rx_overruns);
        puts_(" txto ");
        put_u32(g_stats.tx_timeouts);
        puts_("\r\n");
    } else if (strncmp(line, "reg ", 4) == 0) {
        uint16_t v;
        uint16_t addr = (uint16_t)parse_hex(line + 4, &p);
        if (regs_read(addr, &v) == REG_OK) {
            put_u32(v);
            puts_("\r\n");
        } else {
            puts_("no such register\r\n");
        }
    } else if (strncmp(line, "set ", 4) == 0) {
        uint16_t addr = (uint16_t)parse_hex(line + 4, &p);
        uint16_t val = (uint16_t)parse_hex(p, &p);
        puts_(regs_write(addr, val) == REG_OK ? "ok\r\n" : "refused\r\n");
    } else if (strcmp(line, "tick") == 0) {
        put_u32(task_tick_count());
        puts_(" ");
        put_u32(timebase_ms());
        puts_("\r\n");
    } else if (strcmp(line, "assert") == 0) {
        configASSERT(0);
    } else {
        puts_("?\r\n");
    }
}

static void console_task(void *arg)
{
    (void)arg;
    puts_("GW-400 devkit console\r\n> ");
    for (;;) {
        while (USART1->SR & USART_SR_RXNE) {
            char c = (char)USART1->DR;
            if (c == '\r' || c == '\n') {
                if (s_len > 0U) {
                    s_line[s_len] = '\0';
                    cmd(s_line);
                    s_len = 0;
                }
                puts_("> ");
            } else if (s_len < LINE_MAX - 1U) {
                s_line[s_len++] = c;
            }
        }
        task_delay(pdMS_TO_TICKS(20U));
    }
}

void console_init(void)
{
    RCC->APB2ENR |= (1UL << 4);    /* USART1 clock */
    hal_gpio_af(GPIOA, 9U, 7U);
    hal_gpio_af(GPIOA, 10U, 7U);
    hal_uart_init(USART1, hal_rcc_pclk2(), CONSOLE_BAUD, HAL_UART_PARITY_NONE, 1U);
    (void)task_create(console_task, "console", 384U, 0, PRIO_CONSOLE, 0);
}

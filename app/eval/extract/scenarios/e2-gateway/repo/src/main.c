/*
 * main.c - GW-400 sensor gateway
 */
#include "board.h"
#include "app.h"
#include "misc.h"
#include "selftest.h"

int main(void)
{
    board_init();
    selftest_run();
    selftest_blink();
    timebase_init();
    rtos_init();
    app_init();
    rtos_start();      /* does not return */
    for (;;) {
    }
}

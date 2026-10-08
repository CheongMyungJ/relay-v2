/*
 * config_store.c - settings in flash sector 11
 *
 * Writing needs a sector erase, which stalls the CPU while it runs. The settings
 * task does it at the lowest priority; while it runs g_cfg_busy is set and setting
 * writes are refused.
 */
#include <string.h>
#include "misc.h"
#include "app.h"
#include "modbus.h"
#include "nimbus_hal.h"

#define SETTINGS_SECTOR     11U
#define SETTINGS_ADDR       0x080E0000UL
#define SETTINGS_MAGIC      0x47573430UL    /* "GW40" */

struct stored {
    uint32_t magic;
    settings_t s;
    uint16_t crc;
};

settings_t g_settings;
volatile uint8_t g_cfg_busy;
static sem_t s_save_req;

static const settings_t s_defaults = {
    .slave_addr = 1U,
    .baud_code = 0xFFU,     /* use the variant default */
    .alarm_high = 800,
    .alarm_low = -100,
    .avg_window = 16U,
};

void config_load(void)
{
    const struct stored *st = (const struct stored *)SETTINGS_ADDR;
    s_save_req = sem_create_binary();
    if (st->magic == SETTINGS_MAGIC &&
        mb_crc16((const uint8_t *)&st->s, sizeof(st->s)) == st->crc) {
        g_settings = st->s;
    } else {
        g_settings = s_defaults;
    }
}

uint32_t config_baud(void)
{
    switch (g_settings.baud_code) {
    case 0:
        return 9600UL;
    case 1:
        return 19200UL;
    case 2:
        return 115200UL;
    default:
        return CFG_MB_BAUD;
    }
}

void config_request_save(void)
{
    sem_give(s_save_req);
}

static int write_settings(void)
{
    struct stored st;
    memset(&st, 0xFF, sizeof(st));
    st.magic = SETTINGS_MAGIC;
    st.s = g_settings;
    st.crc = mb_crc16((const uint8_t *)&st.s, sizeof(st.s));

    if (hal_flash_unlock() != 0) {
        return -1;
    }
    int r = hal_flash_erase_sector(SETTINGS_SECTOR);
    const uint32_t *w = (const uint32_t *)&st;
    for (uint32_t i = 0; r == 0 && i < (sizeof(st) + 3U) / 4U; i++) {
        r = hal_flash_program_word(SETTINGS_ADDR + i * 4U, w[i]);
    }
    hal_flash_lock();
    return r;
}

void cfg_task(void *arg)
{
    (void)arg;
    for (;;) {
        (void)sem_take(s_save_req, portMAX_DELAY);
        g_cfg_busy = 1U;
        (void)write_settings();
        g_cfg_busy = 0U;
    }
}

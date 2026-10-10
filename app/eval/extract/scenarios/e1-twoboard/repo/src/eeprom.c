/*
 * eeprom.c - settings stored in the last flash page (EEPROM emulation)
 *
 * A save request is served from the main loop. Programming can fail when the page
 * is worn; the write is retried CFG_EE_RETRY_MAX times before FAULT_EEPROM is raised.
 */
#include "eeprom.h"
#include "board.h"
#include "control.h"
#include "fault.h"
#include "timer.h"

#define EE_MAGIC        0x5443U     /* "TC" */
#define EE_PAGE_ADDR    0x0801F800UL

struct ee_image {
    uint16_t magic;
    int16_t setpoint_dc;
    uint16_t mode;
    uint16_t crc;
};

static volatile uint8_t s_save_pending;
static uint8_t s_attempts;

static uint16_t crc16(const uint8_t *p, uint32_t n)
{
    uint16_t crc = 0xFFFFU;
    while (n--) {
        crc ^= *p++;
        for (uint8_t i = 0; i < 8U; i++) {
            crc = (crc & 1U) ? (uint16_t)((crc >> 1) ^ 0xA001U) : (uint16_t)(crc >> 1);
        }
    }
    return crc;
}

static void flash_unlock(void)
{
    if (FLASH->CR & FLASH_CR_LOCK) {
        FLASH->KEYR = FLASH_KEY1;
        FLASH->KEYR = FLASH_KEY2;
    }
}

static int flash_write(const struct ee_image *img)
{
    const uint16_t *src = (const uint16_t *)img;
    volatile uint16_t *dst = (volatile uint16_t *)EE_PAGE_ADDR;

    flash_unlock();
    FLASH->CR |= FLASH_CR_PER;
    FLASH->AR = EE_PAGE_ADDR;
    FLASH->CR |= FLASH_CR_STRT;
    while (FLASH->SR & FLASH_SR_BSY) {
    }
    FLASH->CR &= ~FLASH_CR_PER;
    delay_ms(5U);   /* page erase recovery time from the Acme M3 flash note AN-112 */

    FLASH->CR |= FLASH_CR_PG;
    for (uint32_t i = 0; i < sizeof(*img) / 2U; i++) {
        dst[i] = src[i];
        while (FLASH->SR & FLASH_SR_BSY) {
        }
        if (FLASH->SR & FLASH_SR_PGERR) {
            FLASH->SR = FLASH_SR_PGERR;
            FLASH->CR &= ~FLASH_CR_PG;
            return -1;
        }
    }
    FLASH->CR &= ~FLASH_CR_PG;
    FLASH->CR |= FLASH_CR_LOCK;
    return 0;
}

uint8_t ee_load(void)
{
    const struct ee_image *img = (const struct ee_image *)EE_PAGE_ADDR;

    if (img->magic != EE_MAGIC) {
        return 0U;      /* blank page: keep compiled-in defaults */
    }
    if (crc16((const uint8_t *)img, sizeof(*img) - 2U) != img->crc) {
        return FAULT_CFG_CRC;
    }
    g_setpoint_dc = img->setpoint_dc;
    g_mode = (uint8_t)img->mode;
    return 0U;
}

void ee_request_save(void)
{
    s_save_pending = 1U;
    s_attempts = 0U;
}

int ee_busy(void)
{
    return s_save_pending != 0U;
}

void ee_poll(void)
{
    struct ee_image img;

    if (!s_save_pending) {
        return;
    }
    img.magic = EE_MAGIC;
    img.setpoint_dc = g_setpoint_dc;
    img.mode = g_mode;
    img.crc = crc16((const uint8_t *)&img, sizeof(img) - 2U);

    if (flash_write(&img) == 0) {
        s_save_pending = 0U;
        return;
    }
    if (++s_attempts >= CFG_EE_RETRY_MAX) {
        s_save_pending = 0U;
        fault_raise(FAULT_EEPROM);
    }
}

/*
 * spi_flash.c - append-only log in an external 4 MB SPI NOR flash (pro, devkit)
 *
 * The log wraps: when the write pointer reaches the end it starts again at 0 and
 * erases 4 KB sectors ahead of itself.
 */
#include "misc.h"
#include "board.h"

#define FLASH_SIZE          (4UL * 1024UL * 1024UL)
#define SECTOR_SIZE         4096UL
#define CMD_WREN            0x06U
#define CMD_RDSR            0x05U
#define CMD_PP              0x02U
#define CMD_SE              0x20U
#define SR_WIP              0x01U

static uint32_t s_wr;

static void cs(int active)
{
    hal_gpio_write(FLASH_CS_PORT, FLASH_CS_PIN, !active);
}

static void wait_ready(void)
{
    uint8_t sr;
    do {
        cs(1);
        (void)hal_spi_xfer(SPI1, CMD_RDSR);
        sr = hal_spi_xfer(SPI1, 0xFFU);
        cs(0);
    } while (sr & SR_WIP);
}

static void write_enable(void)
{
    cs(1);
    (void)hal_spi_xfer(SPI1, CMD_WREN);
    cs(0);
}

static void cmd_addr(uint8_t cmd, uint32_t addr)
{
    (void)hal_spi_xfer(SPI1, cmd);
    (void)hal_spi_xfer(SPI1, (uint8_t)(addr >> 16));
    (void)hal_spi_xfer(SPI1, (uint8_t)(addr >> 8));
    (void)hal_spi_xfer(SPI1, (uint8_t)addr);
}

void spi_flash_init(void)
{
    RCC->APB2ENR |= RCC_APB2ENR_SPI1;
    hal_gpio_mode(FLASH_CS_PORT, FLASH_CS_PIN, HAL_GPIO_OUTPUT);
    cs(0);
    hal_spi_init(SPI1, hal_rcc_pclk2(), 20000000UL);
    s_wr = 0;
}

int spi_flash_append(const void *data, uint16_t len)
{
    const uint8_t *p = data;
    if (s_wr + len > FLASH_SIZE) {
        s_wr = 0;
    }
    if ((s_wr % SECTOR_SIZE) == 0U || (s_wr / SECTOR_SIZE) != ((s_wr + len - 1U) / SECTOR_SIZE)) {
        uint32_t sector = ((s_wr + len - 1U) / SECTOR_SIZE) * SECTOR_SIZE;
        write_enable();
        cs(1);
        cmd_addr(CMD_SE, sector);
        cs(0);
        wait_ready();
    }
    write_enable();
    cs(1);
    cmd_addr(CMD_PP, s_wr);
    for (uint16_t i = 0; i < len; i++) {
        (void)hal_spi_xfer(SPI1, p[i]);
    }
    cs(0);
    wait_ready();
    s_wr += len;
    return 0;
}

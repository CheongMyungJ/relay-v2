# pro: four sensor channels, data logger on SPI flash, low-power idle
VARIANT_CFLAGS := -DVARIANT_PRO
VARIANT_SRCS  := src/logger.c src/spi_flash.c src/power.c

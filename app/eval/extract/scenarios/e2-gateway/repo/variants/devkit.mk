# devkit: pro hardware with diagnostics and kernel assertions (internal use)
VARIANT_CFLAGS := -DVARIANT_DEVKIT -DMB_DIAG_ENABLE
VARIANT_SRCS  := src/logger.c src/spi_flash.c src/console.c

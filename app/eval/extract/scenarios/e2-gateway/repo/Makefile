# GW-400 sensor gateway firmware
#
#   make                  basic variant (default)
#   make VARIANT=pro
#   make VARIANT=devkit   internal debug build
#
# Each variant has variants/<name>.mk (extra flags and sources) and a generated
# configuration header cfg/variant_<name>.h that is force-included into every
# translation unit. Regenerate the headers with tools/gen_variant.py after editing
# variants.yaml.

VARIANT ?= basic
include variants/$(VARIANT).mk

CROSS   ?= arm-none-eabi-
CC      := $(CROSS)gcc
OBJCOPY := $(CROSS)objcopy

CFLAGS  := -mcpu=cortex-m4 -mthumb -O2 -ffreestanding -fno-common -Wall -Wextra \
           -Iinclude -Ithird_party/picortos/include -Ivendor/nimbus/include \
           -include cfg/variant_$(VARIANT).h $(VARIANT_CFLAGS)
LDFLAGS := -nostdlib -T vendor/nimbus/n4_flash.ld -Wl,--gc-sections

APP_SRCS := src/main.c src/app_init.c src/board.c src/timebase.c src/rs485.c \
            src/modbus.c src/mb_handlers.c src/regs.c src/sensor.c src/stats.c \
            src/wdog.c src/config_store.c src/alarm.c src/selftest.c

RTOS_SRCS := third_party/picortos/src/tasks.c third_party/picortos/src/queue.c \
             third_party/picortos/port/cm4/port.c

HAL_SRCS := vendor/nimbus/src/startup_n4.c vendor/nimbus/src/system_n4.c \
            vendor/nimbus/src/nimbus_hal.c

SRCS := $(APP_SRCS) $(VARIANT_SRCS) $(RTOS_SRCS) $(HAL_SRCS)

BUILD := build/$(VARIANT)

.PHONY: all clean

all: $(BUILD)/gw400.bin

$(BUILD)/gw400.elf: $(SRCS) cfg/variant_$(VARIANT).h
	@mkdir -p $(BUILD)
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $(SRCS)

$(BUILD)/gw400.bin: $(BUILD)/gw400.elf
	$(OBJCOPY) -O binary $< $@

clean:
	rm -rf build

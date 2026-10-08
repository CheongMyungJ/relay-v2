# Thermostat controller firmware - build rules
# Usage: make alpha | make beta | make clean
#
# Toolchain: arm-none-eabi-gcc 7.3 (see tools/README)

CROSS   ?= arm-none-eabi-
CC      := $(CROSS)gcc
OBJCOPY := $(CROSS)objcopy
CFLAGS  := -mcpu=cortex-m3 -mthumb -Os -ffreestanding -Wall -Iinclude -Iconfig -Ivendor/acme
LDFLAGS := -nostdlib -T vendor/acme/acme_m3.ld

SRCS := src/main.c src/timer.c src/uart.c src/ring.c src/proto.c src/cmd.c \
        src/control.c src/adc.c src/fault.c src/eeprom.c src/wdt.c src/hwrev.c \
        vendor/acme/startup_acme.c vendor/acme/system_acme.c

# fan control exists only on the beta board
SRCS_beta := src/fan.c

.PHONY: all alpha beta clean

all: alpha

alpha: CFLAGS += -DBOARD_ALPHA
alpha: build/alpha/thermo.bin

beta: CFLAGS += -DBOARD_BETA
beta: build/beta/thermo.bin

build/%/thermo.elf: $(SRCS)
	@mkdir -p $(dir $@)
	$(CC) $(CFLAGS) $(LDFLAGS) -o $@ $(SRCS) $(SRCS_$*)

build/%/thermo.bin: build/%/thermo.elf
	$(OBJCOPY) -O binary $< $@

clean:
	rm -rf build

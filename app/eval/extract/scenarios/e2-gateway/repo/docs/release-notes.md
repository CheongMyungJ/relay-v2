# GW-400 release notes

## 3.2.0 (2021-06)

- Pro: RS-485 default raised to 115200 baud.
- Pro: RTOS tick lowered to 500 Hz to reduce idle power; idle now sleeps (WFI).
- Settings are stored in flash sector 11 instead of the external EEPROM.
- Device identification (function 43) on Pro.

## 3.1.0 (2020-02)

- Pro variant with four sensor channels and the SPI flash data logger.
- Devkit build (Pro hardware, diagnostics function 08, debug console) for internal use only.

## 3.0.0 (2019-05)

- Moved to picoRTOS 3.2.1.
- Lite variant discontinued.

Products shipped: GW-400 (basic) and GW-400 Pro.

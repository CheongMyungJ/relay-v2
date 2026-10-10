# GW-400 firmware

Sensor gateway: reads analog sensors and serves them as Modbus RTU holding registers on
RS-485.

- MCU: Nimbus N4 (Cortex-M4)
- Kernel: picoRTOS 3.2.1 (third_party/picortos)
- Vendor HAL: vendor/nimbus

## Variants

`make VARIANT=<name>` with name one of basic (default), pro, devkit. See variants/ and
variants.yaml. The lite variant is discontinued.

## Documents

- docs/protocol.md: Modbus interface
- docs/register-map.md: holding registers
- docs/release-notes.md
- docs/test-report-2021.md

# System test report, firmware 3.2.0

Test lab, 2021-06-02. Units: GW-400 S/N 2041 (basic), GW-400 Pro S/N 3017.
Master: Modbus test tool on a PC with a USB-RS485 adapter, 1 m cable.

## Response time

Time from the last request byte to the first response byte, 10 000 requests of function 03
(10 registers) each.

| Unit  | Baud   | Mean    | Max     |
| ----- | ------ | ------- | ------- |
| basic | 19200  | 3.9 ms  | 6.2 ms  |
| Pro   | 115200 | 2.4 ms  | 3.1 ms  |

## Endurance

Both units ran 30 days with a request every 100 ms. No resets, no CRC errors.

## Settings write

Writing the alarm threshold (function 06) and reading it back: 20 of 20 passed. During the
write, other requests were answered with exception 06 for about 0.6 s (basic) and 0.5 s (Pro).

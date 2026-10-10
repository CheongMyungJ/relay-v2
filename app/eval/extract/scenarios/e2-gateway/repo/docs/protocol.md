# GW-400 Modbus interface

Document GW-400-IF-02, revision D (2018-03)

## Physical layer

- RS-485, two wire, half duplex.
- 19200 baud, 8 data bits, even parity, 1 stop bit (all products).
- The gateway is always a Modbus RTU slave. Default slave address 1.

## Framing

Standard Modbus RTU. A frame ends after a silent interval of 3.5 character times (t3.5).
Frames with a wrong CRC are discarded without a reply.

CRC: CRC-16/CCITT-FALSE, low byte first.

Broadcast requests (address 0) are executed and never answered.

## Supported functions

| Code | Function                         | Notes                                   |
| ---- | -------------------------------- | --------------------------------------- |
| 03   | Read holding registers           | up to 64 registers                      |
| 06   | Write single register            |                                         |
| 16   | Write multiple registers         | up to 32 registers, all or nothing      |
| 23   | Read/write multiple registers    |                                         |
| 43   | Read device identification       | MEI 14, basic objects                   |

## Exceptions

| Code | Meaning                 | When                                              |
| ---- | ----------------------- | ------------------------------------------------- |
| 01   | Illegal function        | unsupported function code                         |
| 02   | Illegal data address    | register does not exist or is read-only           |
| 03   | Illegal data value      | value out of range, bad quantity                  |
| 04   | Server device failure   | internal error                                    |
| 06   | Server device busy      | settings are being written to flash               |

## Timing

- The gateway answers within 10 ms of the end of the request.
- Settings writes take effect immediately, except slave address and baud rate, which
  apply after the next power cycle.

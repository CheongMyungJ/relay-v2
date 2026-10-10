# TC-200 host protocol

Revision 3 (2017-11)

## Physical layer

UART, 115200 baud, 8 data bits, no parity, 1 stop bit.

## Frame

| Field   | Size | Notes                                  |
| ------- | ---- | -------------------------------------- |
| SOF     | 1    | always 0xA5                            |
| LEN     | 1    | payload length, 0..16                  |
| CMD     | 1    | command code                           |
| PAYLOAD | LEN  |                                        |
| CRC     | 1    | CRC-8, polynomial 0x07, initial 0x00, over LEN, CMD and PAYLOAD |

Bytes of one frame must follow each other within 20 ms; otherwise the device discards the
partial frame.

Responses use the same frame. CMD has bit 7 set and the first payload byte is a status code.

## Commands

| Code | Name         | Payload                  | Response data            |
| ---- | ------------ | ------------------------ | ------------------------ |
| 0x01 | GET_TEMP     | -                        | temperature, int16, 0.1 C |
| 0x02 | SET_SETPOINT | setpoint, int16, 0.1 C   | -                        |
| 0x03 | GET_STATUS   | -                        | faults, mode, overruns, hw rev |
| 0x04 | RESET_FAULT  | mask                     | -                        |
| 0x05 | SET_MODE     | 0 off, 1 heat, 2 auto    | -                        |
| 0x10 | GET_VERSION  | -                        | major, minor, patch      |

The setpoint range is 5.0 C to 85.0 C.

## Status codes

| Code | Meaning          |
| ---- | ---------------- |
| 0x00 | OK               |
| 0x01 | unknown command  |
| 0x02 | CRC error        |
| 0x03 | value out of range |
| 0x04 | busy             |

## Timing

The device answers every frame within 5 ms.

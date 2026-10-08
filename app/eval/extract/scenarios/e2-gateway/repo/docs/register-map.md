# GW-400 register map

All registers are holding registers (function 03 to read, 06/16 to write).

| Address | Name            | Access | Unit / range                     |
| ------- | --------------- | ------ | -------------------------------- |
| 0x0000  | Temperature 1   | R      | 0.1 C                            |
| 0x0001  | Temperature 2   | R      | 0.1 C                            |
| 0x0002  | Pressure        | R      | 0.01 bar (GW-400 Pro)            |
| 0x0003  | Humidity        | R      | 0.1 %RH (GW-400 Pro)             |
| 0x0010  | Alarm high      | R/W    | 1 C, -40 .. 125                  |
| 0x0011  | Alarm low       | R/W    | 1 C, -40 .. 125                  |
| 0x0012  | Averaging       | R/W    | samples, 1 .. 64                 |
| 0x0020  | Slave address   | R/W    | 1 .. 247                         |
| 0x0021  | Baud rate       | R/W    | 0 = 9600, 1 = 19200, 2 = 115200  |
| 0x0030  | Uptime low      | R      | s                                |
| 0x0031  | Uptime high     | R      | s                                |
| 0x0032  | Alarm state     | R      | 0 normal, 1 high, 2 low (relay)  |
| 0x0040  | Frames received | R      | 64-bit counter, 4 registers      |
| 0x0044  | CRC errors      | R      |                                  |

# GW-400 firmware architecture

Written for firmware 3.0 (2019); see the release notes for later changes.

## Tasks

| Task    | Priority | Period / trigger                  | Job                                      |
| ------- | -------- | --------------------------------- | ---------------------------------------- |
| wdog    | 4        | 500 ms, timebase second events    | task supervision, watchdog, uptime       |
| comm    | 4        | Modbus frame queue                | request handling and replies             |
| sensor  | 2        | ADC DMA half-buffer, 25 ms        | filtering, alarm relay                   |
| cfg     | 1        | save request                      | settings to flash                        |
| logger  | 1        | 1 s (Pro)                         | data log to SPI flash                    |

All tasks run on picoRTOS with a 1 ms tick.

## Interrupts

| Source          | Priority | Job                                              |
| --------------- | -------- | ------------------------------------------------ |
| TIM7            | 2        | 1 ms timebase, second event                      |
| USART2          | 5        | end of Modbus frame (t3.5), queue the frame      |
| DMA1 stream 6   | 5        | RS-485 transmit done, release the bus            |
| DMA2 stream 0   | 6        | ADC half-buffer ready                            |

Only interrupts at priority 5 or lower urgency may call kernel functions.

## Data flow

USART2 receive DMA -> idle-line interrupt -> frame queue -> comm task -> register map ->
reply over transmit DMA. The register map reads sensor values under the sensor mutex and
settings directly.

## Settings

Settings live in flash sector 11. A save erases the whole sector (128 KB); the CPU
cannot fetch from flash while the erase runs.

## Watchdog

The independent watchdog is reloaded only if comm and sensor (and logger on Pro)
reported in during the last 500 ms window. Timeout about 2 s.

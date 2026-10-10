/*
 * board.h - GW-400 board definitions
 */
#ifndef BOARD_H
#define BOARD_H

#include <stdint.h>
#include "nimbus_hal.h"

/* RS-485 transceiver on USART2: PA2 TX, PA3 RX, PA1 driver enable (DE, active high) */
#define RS485_UART          USART2
#define RS485_PORT          GPIOA
#define RS485_TX_PIN        2U
#define RS485_RX_PIN        3U
#define RS485_DE_PIN        1U
#define RS485_AF            7U

/* analog inputs PA4..PA7 = ADC channels 4..7 */
#define SENSOR_PORT         GPIOA
#define SENSOR_FIRST_PIN    4U
#define SENSOR_FIRST_CH     4U

/* SPI flash for the data logger (pro, devkit): SPI1 on PA5/PA6/PA7 alternate, CS on PB6 */
#define FLASH_CS_PORT       GPIOB
#define FLASH_CS_PIN        6U

/* status LED */
#define LED_PORT            GPIOC
#define LED_PIN             13U

/*
 * Interrupt priorities (0 = most urgent, 15 = least). Kernel *_from_isr calls are
 * allowed from priority 5 and above (configMAX_SYSCALL_INTERRUPT_PRIORITY).
 */
#define IRQ_PRIO_TIMEBASE   2U      /* TIM7 1 kHz timebase: keep it ahead of everything */
#define IRQ_PRIO_RS485      5U      /* USART2 idle line */
#define IRQ_PRIO_RS485_DMA  5U      /* DMA1 stream 6, RS-485 transmit */
#define IRQ_PRIO_ADC_DMA    6U      /* DMA2 stream 0, ADC scan */

void board_init(void);
void board_led(int on);

#endif /* BOARD_H */

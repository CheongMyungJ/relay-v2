#ifndef FAULT_H
#define FAULT_H

#include <stdint.h>

#define FAULT_OVERTEMP          (1U << 0)
#define FAULT_SENSOR            (1U << 1)
#define FAULT_HEATER_TIMEOUT    (1U << 2)
#define FAULT_EEPROM            (1U << 3)
#define FAULT_CFG_CRC           (1U << 4)

extern volatile uint8_t g_fault_flags;

void fault_raise(uint8_t flags);
void fault_clear(uint8_t mask);
void fault_handle_boot(uint8_t boot_faults);

#endif /* FAULT_H */

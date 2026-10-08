#ifndef EEPROM_H
#define EEPROM_H

#include <stdint.h>

uint8_t ee_load(void);          /* returns fault flags found while loading */
void ee_request_save(void);
int ee_busy(void);
void ee_poll(void);

#endif /* EEPROM_H */

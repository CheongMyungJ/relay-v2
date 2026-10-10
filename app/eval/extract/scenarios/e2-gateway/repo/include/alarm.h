/*
 * alarm.h - temperature alarm relay
 */
#ifndef ALARM_H
#define ALARM_H

#include <stdint.h>

void alarm_init(void);
void alarm_update(int16_t value, int16_t high, int16_t low);
uint8_t alarm_state(void);

#endif /* ALARM_H */

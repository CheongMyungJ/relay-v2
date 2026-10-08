#ifndef FAN_H
#define FAN_H

#include <stdint.h>

extern volatile uint16_t g_fan_rpm;

void fan_init(void);
void fan_set_duty(uint8_t percent);
void fan_poll(void);

#endif /* FAN_H */

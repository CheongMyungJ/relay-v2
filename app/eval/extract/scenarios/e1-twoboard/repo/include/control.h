#ifndef CONTROL_H
#define CONTROL_H

#include <stdint.h>
#include "board.h"

/* temperatures are in deci-degrees Celsius (0.1 C) */
#define SETPOINT_MIN_DC         50
#define SETPOINT_MAX_DC         850
#define SETPOINT_DEFAULT_DC     200
#define HYSTERESIS_DC           5
#define OVERTEMP_DC             900

/* control loop period: a tenth of a second */
#define CTRL_PERIOD_TICKS       (CFG_TICK_HZ / 10U)

/* heater may stay on for at most 60 s */
#define HEATER_MAX_ON_CYCLES    600U

#define MODE_OFF    0U
#define MODE_HEAT   1U
#define MODE_AUTO   2U

extern volatile int16_t g_setpoint_dc;
extern volatile uint8_t g_mode;

void control_init(void);
void control_step(void);
int16_t control_temp_dc(void);

#endif /* CONTROL_H */

/*
 * legacy_pid.c - PID controller used up to firmware 1.x
 *
 * Kept for reference; the 2.x control loop is two-point (see control.c).
 */
#include <stdint.h>

struct pid {
    int32_t kp, ki, kd;     /* gains, Q8 */
    int32_t integ;
    int32_t prev_err;
    int32_t out;            /* heater duty 0..1000 */
};

#define PID_INTEG_LIMIT     50000
#define PID_OUT_MAX         1000

void pid_init(struct pid *p, int32_t kp, int32_t ki, int32_t kd)
{
    p->kp = kp;
    p->ki = ki;
    p->kd = kd;
    p->integ = 0;
    p->prev_err = 0;
    p->out = 0;
}

void pid_update(struct pid *p, int32_t setpoint, int32_t measured)
{
    int32_t err = setpoint - measured;

    p->integ += err;
    if (p->integ > PID_INTEG_LIMIT) {
        p->integ = PID_INTEG_LIMIT;
    } else if (p->integ < -PID_INTEG_LIMIT) {
        p->integ = -PID_INTEG_LIMIT;
    }
    p->out = (p->kp * err + p->ki * p->integ + p->kd * (err - p->prev_err)) >> 8;
    if (p->out > PID_OUT_MAX) {
        p->out = PID_OUT_MAX;
    } else if (p->out < 0) {
        p->out = 0;
    }
    p->prev_err = err;
}

#ifndef ADC_H
#define ADC_H

#include <stdint.h>

extern volatile uint16_t g_adc_raw;
extern volatile int16_t g_cal_offset;

void adc_init(void);
int16_t adc_to_dc(uint16_t raw);

#endif /* ADC_H */

/*
 * sensor.c - analog acquisition with ADC scan + circular DMA
 *
 * DMA2 stream 0 fills s_adc_buf continuously: the half-transfer interrupt means
 * half 0 is complete (DMA now writes half 1), transfer-complete means half 1 is
 * complete. The interrupt hands the finished half to the sensor task, which runs a
 * moving average over g_avg_window samples and publishes g_sensor.
 */
#include <string.h>
#include "sensor.h"
#include "board.h"
#include "app.h"
#include "misc.h"
#include "alarm.h"

#define ADC_SAMPLE_TIME     6U      /* 144 ADC clock cycles per conversion */
#define SAMPLES_PER_HALF    8U

static const hal_dma_t s_adc_dma = { DMA2, DMA2_Stream0, 0U, 0U };
static uint16_t s_adc_buf[2][SAMPLES_PER_HALF][SENSOR_MAX_CH];
static volatile uint8_t s_ready_half;
static sem_t s_half_ready;

static int32_t s_acc[SENSOR_MAX_CH];
static uint16_t s_acc_n;

sensor_data_t g_sensor;
volatile uint16_t g_avg_window = 16U;

void sensor_init(void)
{
    static const uint8_t channels[SENSOR_MAX_CH] = { SENSOR_FIRST_CH, SENSOR_FIRST_CH + 1U,
                                                     SENSOR_FIRST_CH + 2U, SENSOR_FIRST_CH + 3U };
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOA | RCC_AHB1ENR_DMA2;
    RCC->APB2ENR |= RCC_APB2ENR_ADC1;
    for (uint8_t i = 0; i < CFG_SENSOR_CHANNELS; i++) {
        hal_gpio_mode(SENSOR_PORT, (uint8_t)(SENSOR_FIRST_PIN + i), HAL_GPIO_ANALOG);
    }
    s_half_ready = sem_create_binary();
    hal_adc_init_scan(ADC1, channels, (uint8_t)CFG_SENSOR_CHANNELS, ADC_SAMPLE_TIME);
    hal_dma_start(&s_adc_dma, (uint32_t)&ADC1->DR, s_adc_buf,
                  (uint16_t)(2U * SAMPLES_PER_HALF * CFG_SENSOR_CHANNELS), HAL_DMA_P2M, 1, 1, 1);
    NVIC_SetPriority(DMA2_Stream0_IRQn, IRQ_PRIO_ADC_DMA);
    NVIC_EnableIRQ(DMA2_Stream0_IRQn);
    hal_adc_start(ADC1);
    alarm_init();
}

/* called with g_sensor_mutex held */
void sensor_reset_filter(void)
{
    memset(s_acc, 0, sizeof(s_acc));
    s_acc_n = 0;
    g_sensor.sample_count = 0;
}

void DMA2_Stream0_IRQHandler(void)
{
    int woken = pdFALSE;
    uint32_t flags = hal_dma_flags(&s_adc_dma);

    hal_dma_clear(&s_adc_dma, flags);
    if (flags & HAL_DMA_FLAG_HT) {
        s_ready_half = 0;
    } else if (flags & HAL_DMA_FLAG_TC) {
        s_ready_half = 1;
    } else {
        return;
    }
    g_sensor.sample_count++;
    sem_give_from_isr(s_half_ready, &woken);
    port_yield_from_isr(woken);
}

static int16_t scale(uint8_t ch, int32_t avg)
{
    int32_t mv = (avg * 3300) / 4095;
    switch (ch) {
    case 0:
    case 1:
        return (int16_t)(mv - 500);         /* TMP36-style front end: 10 mV per C, 0.1 C units */
    case 2:
        return (int16_t)((mv * 10) / 33);   /* 0..10 bar over 0..3.3 V, 0.01 bar units */
    default:
        return (int16_t)((mv * 1000) / 3300); /* 0..100 %RH, 0.1 % units */
    }
}

void sensor_task(void *arg)
{
    tick_t last = task_tick_count();
    (void)arg;

    for (;;) {
        if (sem_take(s_half_ready, pdMS_TO_TICKS(SENSOR_TIMEOUT_MS)) != pdPASS) {
            g_sensor.fault = 1U;
            wdog_alive(WDOG_SENSOR);
            continue;
        }
        uint8_t half = s_ready_half;
        for (uint8_t s = 0; s < SAMPLES_PER_HALF; s++) {
            for (uint8_t ch = 0; ch < CFG_SENSOR_CHANNELS; ch++) {
                s_acc[ch] += s_adc_buf[half][s][ch];
            }
        }
        s_acc_n = (uint16_t)(s_acc_n + SAMPLES_PER_HALF);

        if (s_acc_n >= g_avg_window) {
            if (mutex_lock(g_sensor_mutex, pdMS_TO_TICKS(20U)) == pdPASS) {
                for (uint8_t ch = 0; ch < CFG_SENSOR_CHANNELS; ch++) {
                    g_sensor.value[ch] = scale(ch, s_acc[ch] / s_acc_n);
                }
                g_sensor.fault = 0U;
                mutex_unlock(g_sensor_mutex);
            }
            alarm_update(g_sensor.value[0], g_settings.alarm_high, g_settings.alarm_low);
            memset(s_acc, 0, sizeof(s_acc));
            s_acc_n = 0;
        }
        wdog_alive(WDOG_SENSOR);
        task_delay_until(&last, pdMS_TO_TICKS(SENSOR_PERIOD_MS));
    }
}

/*
 * board.h - board selection
 *
 * The Makefile passes -DBOARD_ALPHA or -DBOARD_BETA. Each board has a generated
 * configuration header in config/.
 */
#ifndef BOARD_H
#define BOARD_H

#if defined(BOARD_ALPHA)
#include "build_cfg_alpha.h"
#elif defined(BOARD_BETA)
#include "build_cfg_beta.h"
#elif defined(BOARD_GAMMA)
#include "build_cfg_gamma.h"
#else
#error "No board selected: build with make alpha or make beta"
#endif

#include "acme_m3.h"

/* status LED on PB12, heater gate on PB13 */
#define LED_PIN         12U
#define HEATER_PIN      13U
/* hardware revision strap pins PA6 (bit0), PA7 (bit1) */
#define HWREV_PIN0      6U
#define HWREV_PIN1      7U

#endif /* BOARD_H */

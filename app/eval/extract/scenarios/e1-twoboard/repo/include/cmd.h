#ifndef CMD_H
#define CMD_H

#include <stdint.h>

#define CMD_GET_TEMP        0x01U
#define CMD_SET_SETPOINT    0x02U
#define CMD_GET_STATUS      0x03U
#define CMD_RESET_FAULT     0x04U
#define CMD_SET_MODE        0x05U
#define CMD_SET_FAN         0x06U
#define CMD_GET_VERSION     0x10U

void cmd_dispatch(uint8_t cmd, const uint8_t *payload, uint8_t len);

#endif /* CMD_H */

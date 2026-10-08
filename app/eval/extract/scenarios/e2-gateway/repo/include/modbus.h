/*
 * modbus.h - Modbus RTU slave
 */
#ifndef MODBUS_H
#define MODBUS_H

#include <stdint.h>

/* function codes */
#define MB_FC_READ_HOLDING      0x03U
#define MB_FC_WRITE_SINGLE      0x06U
#define MB_FC_DIAGNOSTICS       0x08U
#define MB_FC_WRITE_MULTIPLE    0x10U
#define MB_FC_READ_WRITE        0x17U
#define MB_FC_DEVICE_ID         0x2BU

/* exception codes */
#define MB_EX_NONE              0x00U
#define MB_EX_ILLEGAL_FUNCTION  0x01U
#define MB_EX_ILLEGAL_ADDRESS   0x02U
#define MB_EX_ILLEGAL_VALUE     0x03U
#define MB_EX_DEVICE_FAILURE    0x04U
#define MB_EX_DEVICE_BUSY       0x06U

#define MB_BROADCAST            0x00U
#define MB_MAX_READ_REGS        64U
#define MB_MAX_WRITE_REGS       32U

/* timing (milliseconds, converted with pdMS_TO_TICKS) */
#define MB_IDLE_POLL_MS         100U    /* comm task heartbeat when the bus is quiet */
#define MB_RESP_DELAY_MS        2U      /* gap before answering, lets the master release the bus */
#define MB_TX_TIMEOUT_MS        50U     /* transmit DMA must finish within this */

/*
 * Handler: req points at the PDU (function code first), req_len is the PDU length.
 * Writes the response PDU to resp and its length to resp_len. Returns MB_EX_NONE or an
 * exception code.
 */
typedef uint8_t (*mb_handler_fn)(const uint8_t *req, uint16_t req_len, uint8_t *resp, uint16_t *resp_len);

extern uint8_t g_slave_addr;

void mb_init(uint8_t slave_addr);
int mb_register(uint8_t function_code, mb_handler_fn fn);
uint16_t mb_crc16(const uint8_t *data, uint16_t len);

/* handlers (mb_handlers.c) */
uint8_t mb_fc03_read_holding(const uint8_t *req, uint16_t req_len, uint8_t *resp, uint16_t *resp_len);
uint8_t mb_fc06_write_single(const uint8_t *req, uint16_t req_len, uint8_t *resp, uint16_t *resp_len);
uint8_t mb_fc16_write_multiple(const uint8_t *req, uint16_t req_len, uint8_t *resp, uint16_t *resp_len);
uint8_t mb_fc23_read_write(const uint8_t *req, uint16_t req_len, uint8_t *resp, uint16_t *resp_len);
uint8_t mb_fc43_device_id(const uint8_t *req, uint16_t req_len, uint8_t *resp, uint16_t *resp_len);
uint8_t mb_fc08_diagnostics(const uint8_t *req, uint16_t req_len, uint8_t *resp, uint16_t *resp_len);

#endif /* MODBUS_H */

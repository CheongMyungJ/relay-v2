/*
 * test_crc.c - host test for the Modbus CRC (gcc -Iinclude tests/host/test_crc.c src/modbus.c ...)
 *
 * Only the CRC is exercised; the rest of modbus.c needs the kernel and is not built
 * on the host. Build with: make -C tests/host
 */
#include <stdio.h>
#include <stdint.h>

uint16_t mb_crc16(const uint8_t *data, uint16_t len);

static int check(const char *name, const uint8_t *frame, uint16_t len, uint16_t expect)
{
    uint16_t got = mb_crc16(frame, len);
    if (got != expect) {
        printf("FAIL %s: got %04x expected %04x\n", name, got, expect);
        return 1;
    }
    printf("ok   %s\n", name);
    return 0;
}

int main(void)
{
    /* read holding registers, slave 1, start 0, quantity 2 */
    static const uint8_t req[] = { 0x01, 0x03, 0x00, 0x00, 0x00, 0x02 };
    /* the same frame with its CRC (low byte first) checks to zero */
    static const uint8_t req_crc[] = { 0x01, 0x03, 0x00, 0x00, 0x00, 0x02, 0xC4, 0x0B };
    int fails = 0;

    fails += check("fc03 request", req, sizeof(req), 0x0BC4);
    fails += check("fc03 request with crc", req_crc, sizeof(req_crc), 0x0000);
    return fails ? 1 : 0;
}

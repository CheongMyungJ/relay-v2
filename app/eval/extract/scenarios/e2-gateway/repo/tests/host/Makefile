# Host tests (gcc on the build machine). Only pure functions are covered.
CC ?= gcc
CFLAGS := -Wall -O1 -I../../include -I../../third_party/picortos/include -DHOST_TEST

test_crc: test_crc.c crc_only.c
	$(CC) $(CFLAGS) -o $@ $^
	./test_crc

crc_only.c: ../../src/modbus.c
	sed -n '/^uint16_t mb_crc16/,/^}/p' $< | sed '1i #include <stdint.h>' > $@

clean:
	rm -f test_crc crc_only.c

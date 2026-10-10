/* 픽스처 컴파일 확인용 최소 string.h (newlib 대신). check-fixtures.mjs만 쓴다 */
#pragma once
#include <stddef.h>
void *memcpy(void *, const void *, size_t);
void *memset(void *, int, size_t);
size_t strlen(const char *);
int strcmp(const char *, const char *);
int strncmp(const char *, const char *, size_t);

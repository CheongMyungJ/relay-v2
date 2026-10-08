/* Acme M3 linker script: 128K flash, 20K RAM. Last flash page holds emulated EEPROM. */
MEMORY
{
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 126K
  EEPROM (r)  : ORIGIN = 0x0801F800, LENGTH = 2K
  RAM (rwx)   : ORIGIN = 0x20000000, LENGTH = 20K
}
_estack = ORIGIN(RAM) + LENGTH(RAM);
SECTIONS
{
  .isr_vector : { KEEP(*(.isr_vector)) } > FLASH
  .text : { *(.text*) *(.rodata*) } > FLASH
  _sidata = LOADADDR(.data);
  .data : { _sdata = .; *(.data*) _edata = .; } > RAM AT > FLASH
  .bss : { _sbss = .; *(.bss*) *(COMMON) _ebss = .; } > RAM
  .eeprom (NOLOAD) : { *(.eeprom) } > EEPROM
}

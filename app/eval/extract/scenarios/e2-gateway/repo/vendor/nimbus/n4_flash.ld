/* Nimbus N4: 1 MB flash in 12 sectors, 128 KB SRAM. Sector 11 (0x080E0000) holds settings. */
MEMORY
{
  FLASH (rx)    : ORIGIN = 0x08000000, LENGTH = 896K
  SETTINGS (r)  : ORIGIN = 0x080E0000, LENGTH = 128K
  RAM (rwx)     : ORIGIN = 0x20000000, LENGTH = 128K
}
_estack = ORIGIN(RAM) + LENGTH(RAM);
SECTIONS
{
  .isr_vector : { KEEP(*(.isr_vector)) } > FLASH
  .text : { *(.text*) *(.rodata*) } > FLASH
  _sidata = LOADADDR(.data);
  .data : { _sdata = .; *(.data*) _edata = .; } > RAM AT > FLASH
  .bss : { _sbss = .; *(.bss*) *(COMMON) _ebss = .; } > RAM
}

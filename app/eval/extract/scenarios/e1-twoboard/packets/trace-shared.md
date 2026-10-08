# Packet: trace (lens: shared)

## Source

- Repository (read-only): {repo}
- Base commit: {base}
- Scratch directory (you may write here): {scratch}

## Intent

- Goal: recover functional and non-functional requirement candidates and hardware and communication constraints from this firmware.
- Scope: every build configuration and the project's own code. Vendor HAL, RTOS kernels and third-party libraries are boundaries.
- No toolchain is provided.

## Configurations (from the survey)

- alpha: `make alpha` (defines BOARD_ALPHA, uses config/build_cfg_alpha.h)
- beta: `make beta` (defines BOARD_BETA, uses config/build_cfg_beta.h)

## Unit

- Lens: shared
- Purpose: Trace state shared between interrupt handlers and the main loop: g_fault_flags, g_rx_ring and g_adc_raw, and any other state an interrupt handler writes.
- Scope: Every access with its context and priority, the protection used, and unprotected access pairs, for each configuration.

## Limits

- Soft deadline: 15 minutes. Hard limit: 30 minutes.

# Packet: trace (lens: timing)

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

- Lens: timing
- Purpose: Trace the time constants and delays of the host link (framing) and of supervision (control loop, heater limit, watchdog).
- Scope: Value per configuration, where each is consumed, the tick or clock source and the unit.

## Limits

- Soft deadline: 15 minutes. Hard limit: 30 minutes.

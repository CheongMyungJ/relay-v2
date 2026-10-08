# Packet: trace (lens: variant)

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

- Lens: variant
- Purpose: Trace how the build configurations differ.
- Scope: Build-time and run-time selection, every difference between configurations, which configuration ships, and code no configuration uses.

## Limits

- Soft deadline: 15 minutes. Hard limit: 30 minutes.

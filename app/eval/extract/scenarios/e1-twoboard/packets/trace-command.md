# Packet: trace (lens: command)

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

- Lens: command
- Purpose: Trace the SET_SETPOINT (0x02) host command end to end.
- Scope: From byte reception on the host UART to the response frame, including every error path, for each configuration.

## Limits

- Soft deadline: 15 minutes. Hard limit: 30 minutes.

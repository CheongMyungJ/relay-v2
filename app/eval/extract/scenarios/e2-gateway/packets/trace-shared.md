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

- basic: `make VARIANT=basic` (default)
- pro: `make VARIANT=pro`
- devkit: `make VARIANT=devkit`

## Unit

- Lens: shared
- Purpose: Trace state shared between interrupt handlers and tasks, and between tasks: Modbus frames and statistics, sensor data and DMA buffers, settings.
- Scope: Every access with its context and priority, the protection used, and unprotected access pairs, for each configuration.

## Limits

- Soft deadline: 15 minutes. Hard limit: 30 minutes.

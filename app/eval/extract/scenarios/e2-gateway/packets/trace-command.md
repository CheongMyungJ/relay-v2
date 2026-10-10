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

- basic: `make VARIANT=basic` (default)
- pro: `make VARIANT=pro`
- devkit: `make VARIANT=devkit`

## Unit

- Lens: command
- Purpose: Trace the Modbus write multiple registers request (function 16) end to end.
- Scope: From the first byte on the RS-485 bus to the reply on the bus, including every exception and silent drop, for each configuration.

## Limits

- Soft deadline: 15 minutes. Hard limit: 30 minutes.

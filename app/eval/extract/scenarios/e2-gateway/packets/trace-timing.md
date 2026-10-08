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

- basic: `make VARIANT=basic` (default)
- pro: `make VARIANT=pro`
- devkit: `make VARIANT=devkit`

## Unit

- Lens: timing
- Purpose: Trace the time constants, delays and timeouts of the Modbus link, the sensor acquisition and supervision (watchdog, timebase).
- Scope: Value per configuration, where each is consumed, the tick or clock source and the unit.

## Limits

- Soft deadline: 15 minutes. Hard limit: 30 minutes.

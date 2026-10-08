# Packet: survey

## Source

- Repository (read-only): {repo}
- Base commit: {base}
- Scratch directory (you may write here): {scratch}

## Intent

- Goal: recover functional and non-functional requirement candidates and hardware and communication constraints from this firmware.
- Scope: every build configuration and the project's own code. Vendor HAL, RTOS kernels and third-party libraries are boundaries: record their configuration and call boundary, do not trace their internals.
- No toolchain is provided.

## Unit

- Purpose: discover the build configurations, entry points (reset, vectors, interrupt handlers, main loop or tasks, command tables and commands, DMA channels) and interfaces, mark vendor or third-party code as boundaries, and propose analysis units with a lens each.
- Scope: the whole repository.

## Limits

- Soft deadline: 15 minutes. Hard limit: 30 minutes.

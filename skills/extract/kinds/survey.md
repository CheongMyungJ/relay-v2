# Survey run

## Inputs

- The packet: source location, intent (goal, scope, boundaries, toolchain), the unit (the whole repository) and limits.
- The repository at the base commit. There are no earlier results; this run produces the configurations and units that later trace runs start from.

## Order

1. Build entry. Find every build file (makefiles, CMake, IDE projects, scripts, linker scripts) and read how a configuration is selected: targets and variables, command-line defines, force-included or generated configuration headers, per-configuration source lists. Record each configuration with `name`, `select`, `build_command` and `status`. `confirmed` needs a build file or a tool run that builds it; a name seen only in a header, an `#ifdef`, a comment or a directory no build rule uses is `candidate`.
2. Entry points per configuration. Reset handler and vector table; every interrupt handler a vector table or a registration call connects; the main loop; tasks (where they are created and with which priority); command tables and each command they hold; DMA channels or streams and the peripheral each serves; timers. Set `configs` on each item to the configurations whose build includes it. A handler that no table, vector or registration call reaches goes to `not_found` or `units` instead of being listed as live.
3. Interfaces. Buses, pins, links to a host or a peer, storage, and which configurations use them.
4. Boundaries. Vendor HAL, RTOS kernel, third-party and generated code: `path`, `kind` and the reason (license header, vendor name, directory, generator banner). Do not trace inside them; their configuration values and the calls into them are in scope.
5. Units. Propose analysis units, each with a lens, `priority`, `depends_on` and `reason`. Cover every command, every piece of state shared between interrupt and task or loop, the time constants, and each place where configurations differ.
6. Misses. Record in `not_found`, with searches, what you looked for and did not find.

## Done when

- `done`: every build file and every top-level source directory has been looked at, every configuration has a status, and every entry point found is in `inventory` with its configurations.
- Otherwise `incomplete` with a checkpoint.

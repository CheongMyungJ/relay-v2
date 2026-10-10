# thermo-fw

Firmware for the TC-200 thermostat controller.

Supported boards: ALPHA, BETA and GAMMA.

- ALPHA: original board (Acme M3 @ 72 MHz).
- BETA: production board since 2018 (Acme M3 @ 48 MHz, adds fan control).
- GAMMA: low-cost variant.

Build with `make alpha` or `make beta`. Board settings live in `boards/*.yaml`; run
`tools/cfggen.py` to regenerate `config/build_cfg_*.h` after editing them.

The serial protocol is described in `docs/protocol.md`.

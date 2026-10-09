# 렌즈: lifecycle

<!-- 점검표만 있다. Scope, Trace, Pitfalls, Phrasing, Review questions, Example은 기준선을 잰 뒤에 쓴다(requirements-extraction-flow.md 결정 16). ID는 16.6절 초안이다. -->

## Checklist

| ID | Meaning |
| --- | --- |
| `order` | Init, power and recovery order |
| `order_basis` | Why the order is so |
| `low_power` | Low-power entry and wake-up |
| `watchdog` | Watchdog |
| `fault` | Fault handling |
| `across_reset` | Data that survives reset, where it is placed and what clears it first (startup code, bootloader) |

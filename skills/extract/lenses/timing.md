# 렌즈: timing

<!-- 점검표만 있다. Scope, Trace, Pitfalls, Phrasing, Review questions, Example은 기준선을 잰 뒤에 쓴다(requirements-extraction-flow.md 결정 16). ID는 16.6절 초안이다. -->

## Checklist

| ID | Meaning |
| --- | --- |
| `per_config_value` | Value per configuration |
| `consumer` | Where the value is consumed |
| `tick_source` | Tick or clock source |
| `unit` | Unit |
| `comparison` | Comparison operator and off-by-one tick |
| `counting_context` | Context that counts (ISR, task, loop) |
| `overflow` | Overflow and wraparound |
| `nature` | Nature of the value (setting, computed, observed, spec) |

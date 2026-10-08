# 렌즈: state

<!-- 점검표만 있다. Scope, Trace, Pitfalls, Phrasing, Review questions, Example은 기준선을 잰 뒤에 쓴다(requirements-extraction-flow.md 결정 16). ID는 16.6절 초안이다. -->

## Checklist

| ID | Meaning |
| --- | --- |
| `all_writes` | Every place that writes the state variable |
| `transitions` | Transitions (from, to, condition) |
| `unexplained_writes` | Writes you cannot explain |
| `async_writes` | Asynchronous writes from ISRs or other tasks |
| `after_reset` | State after reset |

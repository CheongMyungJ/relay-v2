# 렌즈: shared

<!-- 점검표만 있다. Scope, Trace, Pitfalls, Phrasing, Review questions, Example은 기준선을 잰 뒤에 쓴다(requirements-extraction-flow.md 결정 16). ID는 16.6절 초안이다. -->

## Checklist

| ID | Meaning |
| --- | --- |
| `access_list` | Every access to the shared state |
| `context_priority` | Context and priority of each access |
| `protection` | Protection (critical section, lock, atomicity) |
| `read_modify_write` | Read-modify-write sequences |
| `dma_ownership` | Ownership of DMA buffers |
| `unprotected_pairs` | Access pairs without protection |

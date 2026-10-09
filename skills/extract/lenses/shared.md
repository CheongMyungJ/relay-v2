# Lens: shared

<!-- 렌즈 카드(16.3). trace run은 Scope, Trace, Pitfalls, Phrasing, Example을 받고, Checklist의 뜻은 필드 안내(L3)로 받는다. Review questions는 review run을 평가에 넣을 때 쓴다(결정 18). Example은 가상의 펌웨어로, 평가 시나리오와 겹치지 않게 쓴다. -->

## Scope

One piece of shared state (a variable, a buffer, a peripheral register, a DMA buffer) used from more than one context: interrupt handlers, tasks, the main loop or a DMA engine.

## Trace

- `access_list`: every read and write, with the function, the context it runs in, and the configurations. Search for accesses through pointers, macros and aliases too.
- `context_priority`: the priority of each context and where it is set (interrupt priority calls, kernel configuration, task creation), and which context can preempt which.
- `protection`: what guards each access (interrupt masking, a critical section, a lock, an atomic type or instruction), and whether that guard is valid in the context that uses it.
- `read_modify_write`: sequences that read, change and write back, and whether another writer can run between the read and the write.
- `dma_ownership`: when the DMA engine owns a buffer and when the CPU does, which event hands it over, and whether the CPU touches it while the DMA engine owns it.
- `dma_memory`: for each buffer a DMA engine uses, the section and memory region it lands in for each configuration (linker script, section attributes) and whether that DMA engine can reach that region. Code that looks right still fails when the buffer sits where the DMA cannot reach.
- `unprotected_pairs`: pairs of accesses with no guard between them, and for each pair whether preemption between them is possible given the priorities.

## Checklist

| ID | Meaning |
| --- | --- |
| `access_list` | Every access to the shared state |
| `context_priority` | Context and priority of each access |
| `protection` | Protection (critical section, lock, atomicity) |
| `read_modify_write` | Read-modify-write sequences |
| `dma_ownership` | Ownership of DMA buffers |
| `dma_memory` | Whether each DMA buffer sits in memory that DMA can reach, per configuration |
| `unprotected_pairs` | Access pairs without protection |

## Pitfalls

- A race needs two anchored accesses and a way for one context to preempt the other. When priorities or masking rule that out, write that as an observation instead of a race.
- A guard that the calling context is not allowed to use does not protect; record it as a `conflicts` or `constraints` item with both anchors.
- "No other writer" is an absence claim: put it in `absences` with the searches.
- A single aligned load or store can be atomic on the target while a multi-word value or a read-modify-write is not; say which, and on what basis.
- Priorities set only in vendor initialization outside scope are `unknown`; leave the cell `unknown` and name the missing anchor in `unknowns`.

## Phrasing

- Access: "<문맥>(<우선순위>)의 <함수>가 <상태>를 <읽는다/쓴다>." One access per item.
- Pair: "<접근 A>와 <접근 B> 사이에 보호가 없고, <문맥 B>가 <문맥 A>를 선점할 수 있다(근거: 우선순위)."

## Example

```json
{
  "observations": [
    {
      "key": "o1",
      "text": "모든 구성에서 ADC 완료 인터럽트(우선순위 2)의 adc_isr가 g_level을 쓴다.",
      "configs": ["all"],
      "anchors": [
        { "kind": "code", "path": "src/level.c", "start": 30, "end": 30, "quote": "g_level = ADC_DR;", "command": null }
      ],
      "inference": false
    },
    {
      "key": "o2",
      "text": "모든 구성에서 메인 루프의 level_report가 인터럽트를 막지 않고 g_level을 두 번 읽는다.",
      "configs": ["all"],
      "anchors": [
        { "kind": "code", "path": "src/report.c", "start": 52, "end": 53, "quote": "lo = g_level & 0xFF; hi = g_level >> 8;", "command": null }
      ],
      "inference": false
    }
  ],
  "conflicts": [],
  "checklist": {
    "access_list": { "status": "covered", "refs": ["o1", "o2"], "searches": [] },
    "unprotected_pairs": { "status": "covered", "refs": ["o1", "o2"], "searches": [] }
  }
}
```

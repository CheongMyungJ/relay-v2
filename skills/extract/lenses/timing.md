# Lens: timing

<!-- 렌즈 카드(16.3). trace run은 Scope, Trace, Pitfalls, Phrasing, Example을 받고, Checklist의 뜻은 필드 안내(L3)로 받는다. Review questions는 review run을 평가에 넣을 때 쓴다(결정 18). Example은 가상의 펌웨어로, 평가 시나리오와 겹치지 않게 쓴다. -->

## Scope

Every time behavior the unit's purpose names: the constants (timeouts, periods, delays, supervision windows) with their value in every configuration, where each is consumed, what advances the count and the unit, and also the waits on those paths (busy loops, blocking calls, calls into boundaries) with how long each can last.

## Trace

- `per_config_value`: resolve the value per configuration: header default, command-line defines, force-included or generated headers, per-configuration sources. When two definitions compete, cite both and say which one wins and why.
- `consumer`: every place the value is used, not only the first.
- `tick_source`: what advances the counter or timer (an interrupt, a hardware timer, a loop pass) and its rate from code: reload and prescaler values and the input clock, each anchored.
- `unit`: `derived` only when the rate is anchored down to a clock the code sets or a tool measured. Otherwise give the value in ticks or counts.
- `comparison`: the operator (`>` or `>=`), where the counter is reset, and whether the first tick is partial. When the effective time has a range, give both ends.
- `counting_context`: which context increments and which compares (interrupt, task, loop), and whether that context can be delayed or skipped.
- `overflow`: the counter's width, how a wrap is handled, and how long until it wraps.
- `nature`: `setting`, `computed`, `observed` or `spec`, as the contract defines.
- Waits: for each wait or blocking step on these paths, its duration as far as code or anchored documents give it, and which timeout or supervision window runs around it. When the wait can approach or exceed that window, write an observation that anchors both.

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

## Pitfalls

- A name or comment that says ms, us or Hz is `name_guess` until the rate is derived; write the unit from the name only together with that status.
- A clock rate that only a datasheet, a comment or vendor initialization outside scope gives ends the chain: keep the value in ticks, add an `unknowns` item with `needs: external_doc`, and record the comment's figure as `doc_claim`.
- A busy-wait loop's duration depends on the clock and the compiler: record its count, `unit_status: unknown`, and the loop as an `impl_choices` item.
- When configurations have different values, write one `values` entry per configuration; `all` only when you checked that they are the same.
- A time measured in a log or stated in a document is `observed` or `doc_claim`, not the value the code sets; when the two differ, write a `conflicts` item.
- A timeout the code chose is a `setting`; it becomes a constraint only with a reason outside the code (peer, protocol, hardware), anchored.

## Phrasing

- `value`: "<n> tick" when only ticks are derived; "<n> tick = <t> ms" only when `unit_status` is `derived`; "<a>~<b> tick" for a range.
- Quantity text names the configuration when values differ: "fast: 40 tick, slow: 80 tick".

## Example

```json
{
  "quantities": [
    {
      "key": "q1",
      "symbol": "PUMP_STALL_TICKS",
      "expr": "#define PUMP_STALL_TICKS (STALL_MS / TICK_MS)",
      "values": [
        { "configs": ["pump_s"], "value": "50 tick" },
        { "configs": ["pump_l"], "value": "100 tick" }
      ],
      "unit": "tick",
      "unit_status": "derived",
      "nature": "computed",
      "chain": [
        { "role": "value", "anchor": { "kind": "code", "path": "inc/pump_cfg.h", "start": 12, "end": 12, "quote": "#define PUMP_STALL_TICKS (STALL_MS / TICK_MS)", "command": null } },
        { "role": "consumer", "anchor": { "kind": "code", "path": "src/pump.c", "start": 88, "end": 88, "quote": "if (stall_cnt >= PUMP_STALL_TICKS) {", "command": null } },
        { "role": "tick_source", "anchor": { "kind": "code", "path": "src/tick.c", "start": 20, "end": 20, "quote": "void SysTick_Handler(void) { stall_cnt++; }", "command": null } }
      ],
      "anchors": []
    }
  ],
  "unknowns": [
    { "key": "u1", "question": "SysTick 입력 클럭이 레포에 없어 1 tick의 시간을 확정할 수 없다.", "needs": "external_doc", "refs": ["q1"] }
  ],
  "checklist": {
    "unit": { "status": "unknown", "refs": ["q1", "u1"], "searches": [] },
    "comparison": { "status": "covered", "refs": ["q1"], "searches": [] }
  }
}
```

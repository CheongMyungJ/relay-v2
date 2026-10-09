# Lens: lifecycle

<!-- 렌즈 카드(16.3). trace run은 Scope, Trace, Pitfalls, Phrasing, Example을 받고, Checklist의 뜻은 필드 안내(L3)로 받는다. Review questions는 review run을 평가에 넣을 때 쓴다(결정 18). Example은 가상의 펌웨어로, 평가 시나리오와 겹치지 않게 쓴다. 14차 작업에서 점검표만 있던 카드에 절을 썼다(AI 결정 128). -->

## Scope

How the device starts, changes power state, is watched and recovers: from the reset vector through initialization to the main loop or scheduler, low-power entry and wake-up, the watchdog, fault handlers, and what survives a reset.

## Trace

- `order`: the sequence from the reset handler (startup copy and zeroing, clock setup, peripheral and driver init, interrupt enabling, task creation, scheduler start), per configuration, as the code runs it. Calls inside a boundary are steps; read their documentation for what each does.
- `order_basis`: why each dependency exists where the code shows it (a clock before a peripheral, a peripheral before its interrupt is enabled, a storage read before a mode is chosen). A comment that only claims an order is a `doc_claim`.
- `low_power`: every place that enters a sleep or stop mode, what must be true before it, what wakes it, and what is restored after wake-up.
- `watchdog`: where it is started and with which timeout source, every place that feeds it, what must keep running for it to be fed, and what happens on expiry. A timeout value goes into `quantities` with its chain.
- `fault`: fault and error handlers (hard fault, bus errors, assertion and panic routines, brown-out), what each records or resets, and whether the device restarts or halts.
- `across_reset`: data meant to survive a reset or to tell the next start why it reset: its section and address range per configuration, who writes it, and what clears it first (startup code, a bootloader).

## Checklist

| ID | Meaning |
| --- | --- |
| `order` | Init, power and recovery order |
| `order_basis` | Why the order is so |
| `low_power` | Low-power entry and wake-up |
| `watchdog` | Watchdog |
| `fault` | Fault handling |
| `across_reset` | Data that survives reset, where it is placed and what clears it first (startup code, bootloader) |

## Pitfalls

- An order in a comment or a document is a `doc_claim`; describe the order the code runs, and write a `conflicts` item when they differ.
- A feed in a loop is only a guarantee when every path through the loop reaches it; a long or blocking step between feeds is the timing question to trace, not a constraint to assume.
- A fault handler that loops forever and one that resets behave differently for the product; say which, per configuration.
- Data in a "no init" section survives only if startup code and any bootloader leave that range alone; check both before writing that it survives.
- Clock and power settings done by generated or vendor code are in scope as values: record the values and the call, not the vendor internals.

## Phrasing

- Step: "<구성>에서 <앞 단계> 뒤에 <함수>가 <무엇>을 초기화한다(근거: <호출 위치>)." One step per item.
- Watchdog: "<구성>에서 <함수>가 <주기 근거>마다 워치독을 먹이고, 못 먹이면 <결과>."

## Example

```json
{
  "observations": [
    {
      "key": "o1",
      "text": "charger_a와 charger_b에서 reset_handler가 시스템 클럭을 설정한 뒤 meter_setup을 부르고, 그 다음에 인터럽트를 켠다.",
      "configs": ["charger_a", "charger_b"],
      "anchors": [
        { "kind": "code", "path": "boot/startup.c", "start": 40, "end": 42, "quote": "clock_setup(); meter_setup(); irq_enable_all();", "command": null }
      ],
      "inference": false
    },
    {
      "key": "o2",
      "text": "charger_b에서만 메인 루프가 매 회차 끝에 wdog_feed를 부른다.",
      "configs": ["charger_b"],
      "anchors": [
        { "kind": "code", "path": "app/main_loop.c", "start": 77, "end": 79, "quote": "#ifdef HAS_WDOG wdog_feed(); #endif", "command": null }
      ],
      "inference": false
    }
  ],
  "unknowns": [
    { "key": "u1", "question": "워치독 클럭의 주파수는 데이터시트에만 있어 만료 시간을 ms로 정할 수 없다.", "needs": "external_doc", "refs": ["o2"] }
  ],
  "checklist": {
    "order": { "status": "covered", "refs": ["o1"], "searches": [] },
    "watchdog": { "status": "covered", "refs": ["o2", "u1"], "searches": [] }
  }
}
```

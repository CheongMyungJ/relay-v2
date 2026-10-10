# Lens: state

<!-- 렌즈 카드(16.3). trace run은 Scope, Trace, Pitfalls, Phrasing, Example을 받고, Checklist의 뜻은 필드 안내(L3)로 받는다. Review questions는 review run을 평가에 넣을 때 쓴다(결정 18). Example은 가상의 펌웨어로, 평가 시나리오와 겹치지 않게 쓴다. 14차 작업에서 점검표만 있던 카드에 절을 썼다(AI 결정 128). -->

## Scope

One state variable (a mode, a flag set, a counter that drives behavior, a stored setting) and everything that reads or changes it, in every configuration that has it.

## Trace

- `all_writes`: every assignment, increment, bit operation, memset or memcpy over it, and every write through a pointer, an alias or a macro. Search the whole repository, including handlers registered at run time and code reached through tables.
- `transitions`: for each write, the old value or values it can come from, the new value, and the condition and event that cause it. Build the table from the writes, not from a comment or an enum declaration.
- `unexplained_writes`: a write whose condition or caller you cannot find, or whose value is not one the rest of the code expects. Leave it here instead of fitting it into a transition.
- `async_writes`: writes from interrupt handlers, other tasks, DMA completion or callbacks, with the context and priority of each, and what the reader does if the value changes between two of its reads.
- `after_reset`: the value before the first write: static initializer, startup zeroing, a value loaded from storage, or a section that keeps its contents across reset. Check per configuration.

## Checklist

| ID | Meaning |
| --- | --- |
| `all_writes` | Every place that writes the state variable |
| `transitions` | Transitions (from, to, condition) |
| `unexplained_writes` | Writes you cannot explain |
| `async_writes` | Asynchronous writes from ISRs or other tasks |
| `after_reset` | State after reset |

## Pitfalls

- An enum or a comment that lists states is not the transition table; a value nothing writes is not a state, and a value only one configuration writes is that configuration's.
- "Only X changes the mode" needs a search for every write, including pointers and other files; put it in `absences` with the searches.
- A write that clears or sets several states at once (a whole-word store, a reset routine) is a transition from every state it can follow.
- The value after reset depends on the section and the startup code; a missing initializer is not zero when the variable sits in a region startup code does not clear.
- A state that a handler changes while the main loop reads it twice is a shared-state question too: add a `followups` unit with the shared lens.

## Phrasing

- Transition: "<구성>에서 <조건>이면 <함수>가 <상태>를 <이전 값>에서 <새 값>으로 바꾼다." One transition per item.
- After reset: "<구성>에서 리셋 뒤 <상태>는 <값>이다(근거: <초기화 위치>)."

## Example

```json
{
  "observations": [
    {
      "key": "o1",
      "text": "모든 구성에서 문이 닫힌 채 잠금 명령이 오면 lock_cmd가 g_lock_state를 LOCK_OPEN에서 LOCK_BUSY로 바꾼다.",
      "configs": ["all"],
      "anchors": [
        { "kind": "code", "path": "app/lock_ctl.c", "start": 48, "end": 49, "quote": "if (door_closed()) { g_lock_state = LOCK_BUSY; }", "command": null }
      ],
      "inference": false
    },
    {
      "key": "o2",
      "text": "모든 구성에서 g_lock_state는 .bss에 있어 리셋 뒤 시작 코드가 0(LOCK_OPEN)으로 지운다.",
      "configs": ["all"],
      "anchors": [
        { "kind": "code", "path": "app/lock_ctl.c", "start": 12, "end": 12, "quote": "static lock_state_t g_lock_state;", "command": null }
      ],
      "inference": false
    }
  ],
  "absences": [
    {
      "key": "a1",
      "claim": "g_lock_state에 쓰는 곳은 lock_cmd, lock_isr, lock_reset 셋뿐이다.",
      "configs": ["all"],
      "searches": [
        { "tool": "Grep", "pattern": "g_lock_state\\s*=", "scope": "app/, drivers/", "hits": 3 },
        { "tool": "Grep", "pattern": "&g_lock_state", "scope": "app/, drivers/", "hits": 0 }
      ]
    }
  ],
  "checklist": {
    "transitions": { "status": "covered", "refs": ["o1"], "searches": [] },
    "after_reset": { "status": "covered", "refs": ["o2"], "searches": [] },
    "all_writes": { "status": "covered", "refs": ["a1"], "searches": [] }
  }
}
```

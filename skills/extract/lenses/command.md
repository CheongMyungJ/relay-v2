# Lens: command

<!-- 렌즈 카드(16.3). trace run은 Scope, Trace, Pitfalls, Phrasing, Example을 받고, Checklist의 뜻은 필드 안내(L3)로 받는다. Review questions는 review run을 평가에 넣을 때 쓴다(결정 18). Example은 가상의 펌웨어로, 평가 시나리오와 겹치지 않게 쓴다. -->

## Scope

One command or request, from the moment its bytes arrive until the response has left and the link is free again, in every configuration that has it.

## Trace

- `entry`: the receive path from the interrupt or DMA completion to the point where a frame is complete, and how a command is recognized: a table, a switch, or a registration made at run time. Check each configuration separately.
- `dispatch`, `precondition`: every check before the handler runs (length, range, address, state, permission) and what each failure returns.
- `normal`: every effect of the command: state written, outputs driven, storage written, other tasks notified. Anchor each write.
- `error`: each error response with its code, and which state is already changed when the error is detected.
- `timeout`, `retry`: who waits and for what, the value through a timing chain (or a `followups` unit with the timing lens), and the retry count.
- `busy_request`: what happens when another request arrives while this one is handled: queued, dropped, overwritten or rejected, and in which context.
- `response`: content, where it is built, and each step until the link can take the next frame, with the event that ends each step.

## Checklist

| ID | Meaning |
| --- | --- |
| `entry` | Where the command comes in (receive path, dispatch table) |
| `dispatch` | Branch that routes the command to its handler |
| `precondition` | Checks before handling (state, length, permission) |
| `normal` | Normal path |
| `error` | Error paths and error responses |
| `timeout` | Timeout path |
| `retry` | Retries and their count |
| `busy_request` | Another request arriving while one is being handled |
| `response` | Response content and where it goes |

## Pitfalls

- A handler that exists is not a command until a table, a switch or a registration call reaches it in that configuration; when nothing does, write an `absences` item with the searches.
- "Only this handler writes X" needs a search for every write to X (including through pointers and other commands); put it in `absences` with the searches.
- A format, checksum or limit stated in a comment or document goes in as `doc_claim`; when the code does something else, write a `conflicts` item.
- A response time seen in a log or a document is `observed` or `doc_claim`; a requirement built on it says so in `basis`.
- Commands that exist only in some configurations get their own `configs`; do not write `all` for them.

## Phrasing

- Observation: "<구성>에서 <조건>이면 <함수>가 <동작>한다." One behavior per item, present tense.
- Requirement: condition, behavior, result as three short phrases, with `refs` to the observations.
- Error path: name the error code exactly as the code spells it.

## Example

```json
{
  "observations": [
    {
      "key": "o1",
      "text": "charger_a와 charger_b에서 SET_LIMIT 요청의 길이가 4바이트가 아니면 cmd_set_limit가 한도를 바꾸지 않고 ERR_LEN 응답을 보낸다.",
      "configs": ["charger_a", "charger_b"],
      "anchors": [
        { "kind": "code", "path": "app/cmd_limit.c", "start": 41, "end": 43, "quote": "if (len != 4) { reply_err(ERR_LEN); return; }", "command": null }
      ],
      "inference": false
    }
  ],
  "absences": [
    {
      "key": "a1",
      "claim": "g_limit_ma에 쓰는 곳은 cmd_set_limit와 limit_init 둘뿐이다.",
      "configs": ["charger_a", "charger_b"],
      "searches": [
        { "tool": "Grep", "pattern": "g_limit_ma\\s*=", "scope": "app/, drivers/", "hits": 2 },
        { "tool": "Grep", "pattern": "&g_limit_ma", "scope": "app/, drivers/", "hits": 0 }
      ]
    }
  ],
  "checklist": {
    "precondition": { "status": "covered", "refs": ["o1"], "searches": [] },
    "retry": {
      "status": "not_applicable",
      "refs": [],
      "searches": [{ "tool": "Grep", "pattern": "retry|resend|attempt", "scope": "app/cmd_*.c", "hits": 0 }]
    }
  }
}
```

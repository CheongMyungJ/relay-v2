# 렌즈: command

<!-- 점검표만 있다. Scope, Trace, Pitfalls, Phrasing, Review questions, Example은 기준선을 잰 뒤에 쓴다(requirements-extraction-flow.md 결정 16). ID는 16.6절 초안이다. -->

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

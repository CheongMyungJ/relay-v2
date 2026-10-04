## docs/knowledge/dispatch/retry-only-failed-sends.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: decide
---
# 재시도는 유지하되 실제로 실패한 발송만 다시 보낸다

## 규칙
- 재시도 기능 자체를 끄거나 줄이면 안 된다. 실제로 실패한 발송(transient 오류, 시간 초과로 실패한 발송)은 지금처럼 다시 보낸다.
- 발송이 성공했으면 제한 시간(`send.timeoutMs`, `digest.sendTimeoutMs`)을 넘겼어도 다시 보내지 않는다. 시간 초과는 실패한 발송에만 적용한다. 성공을 timeout으로 보면 같은 알림이 두 번 간다(메일은 지연이 길어 더 자주 걸림).
- 위치: `src/retry/policy.js`의 `decide()`는 `outcome.ok`를 시간 검사보다 먼저 본다. `src/digest/deadline.js`의 `withDeadline()`은 성공이면 예외를 던지지 않고 `slow`만 표시한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

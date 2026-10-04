## docs/knowledge/notify/retry-keeps-real-failures.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 중복 발송은 재시도를 끄지 않고 없앤다. 실제 실패는 반드시 다시 보낸다

## 규칙
- 중복 발송을 막으려고 재시도 기능을 끄거나 재시도 횟수를 줄이지 않는다.
- 실제로 실패한 발송(오류가 난 것)은 지금처럼 재시도해서 결국 전달한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/notify/slow-success-is-success.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
anchor: decide
---
# 느리게 성공한 발송을 시간 초과 실패로 보면 중복 발송된다

## 내용
- 발송이 성공했으면 걸린 시간과 무관하게 성공이다. 제한 시간(`send.timeoutMs`)을 넘겼다는 이유로 재시도하면 이미 전달된 알림이 또 나간다. 메일은 SMTP 중계가 느려지기 쉬워 더 자주 겪는다.
- 위치: `src/retry/policy.js`의 `decide`는 `outcome.ok`를 시간 초과 검사보다 먼저 본다. 요약은 `src/digest/timing.js`의 `withTiming`이 오류로 바꾸지 않고 `elapsedMs`만 돌려준다.
- 요약 발송 기록 키(`digestKey`, `src/digest/key.js`)에는 `runId`를 넣지 않는다. 같은 기간을 재실행해도 이미 보낸 요약을 다시 보내지 않게 하려는 것이다. 실행별 건수는 발송 기록(entries)의 `runId`로 센다.
- 회귀 테스트: `test/no-double-send.test.js`.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

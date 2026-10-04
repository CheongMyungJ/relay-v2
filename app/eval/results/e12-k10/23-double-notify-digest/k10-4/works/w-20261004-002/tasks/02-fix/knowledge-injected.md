## docs/knowledge/retry/slow-success-is-not-timeout.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
anchor: decide
---
# 느리게 성공한 발송을 시간 초과로 뒤집으면 중복 발송이 난다

## 내용
- 발송이 성공했으면 걸린 시간이 제한 시간(`send.timeoutMs`)을 넘어도 성공이다. 실패로 바꿔 재시도하면 이미 전달된 알림이 다시 간다(재시도 최대 횟수까지 가서 두세 번).
- 메일은 응답이 느려 제한 시간을 넘기기 쉬워 더 자주 나타난다.
- 위치: `src/retry/policy.js`의 `decide`는 `outcome.ok`를 시간 검사보다 먼저 본다. `src/digest/deadline.js`의 `withDeadline`은 성공을 뒤집지 않고 걸린 시간만 잰다.
- 재현 테스트: `test/duplicate-send.test.js`.
- 전달 여부를 알 수 없는 실패(어댑터의 `ETIMEDOUT` 등)는 지금도 재시도되어 드물게 중복될 수 있다. 막으려면 멱등 키가 필요하다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

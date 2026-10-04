## docs/knowledge/delivery/digest-key-includes-run-id.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
anchor: digestKey
---
# 요약 원장 키(digestKey)에 runId가 들어 있어 다른 runId로 다시 돌리면 중복 방지가 듣지 않는다

## 내용
- `src/digest/key.js`의 키에 runId가 포함된다. 같은 기간의 요약을 재시작이나 서버 여러 대로 다른 runId에서 다시 돌리면 원장(`ledger.markSent`)이 막지 못해 요약이 중복될 수 있다.
- Work w-20261004-001에서 발견했으나 이번 증상(느린 성공)과 무관해 고치지 않았다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/delivery/slow-success-is-not-timeout.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
---
# 느리게 성공한 발송을 시간 초과로 보고 재시도하면 중복 발송이 된다

## 내용
- 어댑터가 성공(`outcome.ok`)을 돌려줬으면 걸린 시간과 상관없이 끝난 발송이다. 다시 보내면 같은 알림을 두 번, 재시도 횟수만큼 세 번까지 받는다.
- 메일은 SMTP 중계라 푸시보다 지연이 커서 더 자주 걸린다(fake 기본 지연 메일 400ms, 푸시 80ms).
- 일반 발송은 `src/retry/policy.js` `decide()`에서 `outcome.ok`를 시간 초과 검사보다 먼저 본다. 요약은 `src/digest/deadline.js` `withDeadline()`이 던지지 않고 `slow: true`로 알리고 `runner.js`가 `digest.send.slow` 지표를 올린다.
- 실패한 발송의 시간 초과 재시도는 일부러 유지한다. 새 재시도 경로를 만들 때도 성공 여부를 먼저 본다.
- 테스트: `test/duplicate-send.test.js`

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

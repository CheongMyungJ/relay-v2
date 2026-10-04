## docs/knowledge/retry/digest-key-includes-run-id.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
---
# 요약 키에 runId가 들어가 재실행 시 같은 요약이 다시 나갈 수 있다

## 내용
- `src/digest/key.js`의 요약 키에 runId가 포함되어, 서로 다른 실행(재실행)에서는 같은 요약이 중복 발송될 수 있다. 같은 실행 안의 중복과는 별개이며 Work w-20261004-001에서는 고치지 않았다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/retry/failed-sends-must-retry.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 중복 발송은 재시도를 끄지 않고 고친다. 실제로 실패한 발송은 반드시 재발송한다

## 규칙
- 중복 발송 문제를 재시도 기능을 끄거나 재시도 횟수를 줄여서 해결하지 않는다.
- 어댑터가 실제로 실패한 발송(일시 오류 등)은 재시도로 다시 보낸다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/retry/success-is-never-resent.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: investigation
anchor: decide
---
# 발송이 성공했으면 걸린 시간과 무관하게 재발송하지 않는다

## 규칙
- 어댑터가 성공(`outcome.ok`)을 돌려주면 제한 시간(`send.timeoutMs`, `digest.sendTimeoutMs`)을 넘겼어도 성공이다. 시간 초과 판정은 실패한 발송에만 쓴다.
- 발송 경로(`src/retry/policy.js` `decide`)와 요약 경로(`src/digest/deadline.js` `withDeadline`) 모두 같다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001). 이전에는 느린 성공을 timeout 실패로 보고 재시도해 메일이 2~3번 나갔다.

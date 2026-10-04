## docs/knowledge/dispatch/never-disable-retry-to-stop-duplicates.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 중복 발송은 재시도를 끄거나 줄여서 고치지 않는다

## 규칙
- 중복 발송을 막으려고 재시도를 끄거나 재시도 횟수를 줄이지 않는다.
- 실제로 실패한 발송은 반드시 재시도로 다시 보낸다. 고친 뒤에도 "실패하면 다시 발송된다"는 테스트가 있어야 한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/dispatch/success-before-timeout.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
---
# 발송 결과는 성공 여부를 걸린 시간보다 먼저 판정한다

## 내용
- 어댑터가 성공(접수)했는데 걸린 시간이 제한(`send.timeoutMs` 2초, 요약 `sendTimeoutMs` 3초)을 넘었다고 timeout으로 바꾸면 재시도 때마다 같은 알림이 또 나간다(최대 3통). 지연이 큰 메일 채널에서 더 자주 나타난다.
- 위치: `src/retry/policy.js`의 `decide`(`outcome.ok`를 먼저 검사), `src/digest/deadline.js`의 `withDeadline`(성공 후 초과는 오류가 아니라 `overrun`).
- 실제로 실패하고 시간도 넘긴 발송은 timeout으로 계속 재시도한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

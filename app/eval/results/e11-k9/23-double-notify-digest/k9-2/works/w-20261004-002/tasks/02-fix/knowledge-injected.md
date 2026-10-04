## docs/knowledge/retry/keep-retry-for-real-failures.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 중복 발송을 고친다고 재시도를 끄지 않는다

## 규칙
- 중복 발송은 재시도를 끄거나 횟수·정책을 줄여서 고치지 않는다. 실제로 실패한 발송은 재시도로 다시 보낸다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/retry/success-is-success-regardless-of-time.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
anchor: decide
---
# 제한 시간을 넘겨 성공한 발송을 실패로 재시도하면 중복 발송이 된다

## 내용
- 성공(`outcome.ok`)은 걸린 시간과 무관하게 끝이다. 시간 초과 사유는 실패일 때만 적용한다 (`src/retry/policy.js` decide, 요약은 `src/digest/deadline.js` withDeadline). 즉시 발송 제한은 `send.timeoutMs`(2000ms), 요약은 `digest.sendTimeoutMs`(3000ms).
- 재시도는 (발송에 걸린 시간 + 백오프) 뒤에 나가므로 중복 메일이 첫 메일보다 수 초 늦게 도착하는 것이 이 유형의 징후다.
- 한계: 어댑터가 ETIMEDOUT/ECONNRESET을 던졌는데 서버는 이미 보낸 경우는 결과를 알 수 없어 재시도되며 중복될 수 있다. 막으려면 멱등 키 등 별도 설계가 필요하다.
- 요약 ledger 키에 runId가 들어 있어 run 사이 중복 방지는 안 된다 (`src/digest/key.js`).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

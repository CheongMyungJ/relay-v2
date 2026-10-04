## docs/knowledge/retry/keep-retry-for-real-failures.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
anchor: decide
---
# 중복 발송을 막으려고 재시도를 끄지 않는다

## 규칙
- 중복 발송 문제를 재시도를 끄거나 횟수를 줄여서 풀지 않는다. 실제로 실패한 발송은 반드시 재시도로 다시 보낸다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/retry/slow-success-is-not-failure.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
---
# 성공했지만 느린 발송을 시간 초과로 재시도하면 중복 발송이 된다

## 내용
- 발송 성공 여부와 소요 시간 초과를 섞으면 안 된다. 성공했는데 느리다고 재시도하면 같은 알림이 2~3번(최대 시도 3회) 간다. 메일이 SMTP 중계로 느려 더 자주 걸린다.
- 위치: `src/retry/policy.js` `decide()`는 `outcome.ok`를 시간 검사보다 먼저 본다. `src/digest/deadline.js` `withDeadline()`은 걸린 시간만 돌려주고 성공을 오류로 바꾸지 않는다.
- 남은 경우: 소켓 시간 초과(ETIMEDOUT) 뒤 실제로는 전달됐을 수 있는 발송은 전달 여부를 알 수 없어 재시도하며, 이때 중복은 멱등 키 없이는 남는다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

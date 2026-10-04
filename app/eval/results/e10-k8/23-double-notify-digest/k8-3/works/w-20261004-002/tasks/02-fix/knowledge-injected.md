## docs/knowledge/retry/keep-retry-for-real-failures.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 중복 발송은 재시도를 끄거나 줄여서 해결하지 않는다

## 규칙
- 재시도 기능을 끄거나 재시도 횟수를 줄이는 것은 중복 발송의 해결이 아니다.
- 실제로 발송에 실패한 건은 계속 재시도로 다시 발송되어야 한다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/retry/slow-success-is-not-failure.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
---
# 느리게 성공한 발송을 시간 초과 실패로 보면 같은 알림이 중복 발송된다

## 내용
- 발송이 성공했으면 걸린 시간이 제한 시간(`send.timeoutMs` 2초, 요약 3초)을 넘어도 실패로 보지 않고 재시도하지 않는다. 시간 초과는 실제 실패일 때만 재시도 사유다.
- 위치: `src/retry/policy.js`의 `decide`(성공 검사가 시간 검사보다 먼저), `src/digest/deadline.js`(느리면 `slow` 표시만 한다).
- 메일은 응답이 느려 푸시보다 자주 생긴다.
- 남은 위험: 실제 시간 초과 실패인데 서버가 사실은 보낸 경우의 중복은 어댑터 단에서 막을 수 없다. 요약 키에 runId가 있어 프로세스 재시작이나 수동 재실행 시 같은 기간 요약이 다시 갈 수 있다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

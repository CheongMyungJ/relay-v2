## docs/knowledge/retry/keep-retry-for-real-failures.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: human
---
# 중복 발송을 고칠 때도 재시도는 끄지 않는다

## 규칙
- 재시도 기능과 재시도 횟수·정책은 줄이거나 끄지 않는다.
- 실제로 실패한 발송(예: 어댑터의 시간 초과 오류)은 재시도로 다시 보낸다. 중복 방지는 성공한 발송을 다시 보내지 않는 쪽으로 푼다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001, 사람이 알려 줌)

## docs/knowledge/retry/success-is-never-timeout.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: investigation
---
# 성공한 발송은 걸린 시간과 관계없이 성공이다

## 규칙
- 발송 결과가 성공(`outcome.ok`, `adapter.send` 정상 반환)이면 걸린 시간이 제한 시간(`send.timeoutMs` 2000ms, 요약 3000ms)을 넘어도 완료로 처리하고 다시 보내지 않는다.
- 시간 초과 판정은 실패 응답에만 쓴다. 실제 시간 초과는 어댑터가 던지는 `SendTimeoutError`(ETIMEDOUT 등)로 드러난다.
- 느린 성공은 재시도 대신 `send.<채널>.slow`, `digest.slow` 지표로만 남긴다.
- 위반하면 같은 알림이 2~3통 나간다. 응답이 느린 메일에서 푸시보다 잦다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001). 위치: `src/retry/policy.js` decide, `src/digest/deadline.js` withDeadline

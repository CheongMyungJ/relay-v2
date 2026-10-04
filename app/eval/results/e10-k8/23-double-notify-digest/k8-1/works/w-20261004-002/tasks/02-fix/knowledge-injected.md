## docs/knowledge/delivery/digest-sendtimeout-unused.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
---
# digest.sendTimeoutMs는 지금 요약 발송에 효과가 없다

## 내용
- `withDeadline`(`src/digest/deadline.js`)이 늦은 성공을 더 이상 실패로 보지 않아 `digest.sendTimeoutMs`와 `timeoutMs` 인자는 사용되지 않는다. 설정을 바꿔도 동작이 달라지지 않는다.
- 소요 시간은 `digest.send.ms` 지표로만 남는다. 제한 시간을 다시 쓰려면 실제로 발송을 중단하는 방식이어야 하고, 규칙은 `docs/knowledge/delivery/late-success-is-success.md` 참고.
- 요약 키(`src/digest/key.js`)에 runId가 들어 있어 같은 기간을 다른 runId로 다시 돌리면 요약이 중복될 수 있다(미수정).

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

## docs/knowledge/delivery/late-success-is-success.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: rule
source: investigation
---
# 발송이 성공했으면 제한 시간을 넘겨도 성공으로 본다

## 규칙
- 어댑터가 값을 돌려줬으면(`outcome.ok`) 걸린 시간과 무관하게 성공이다. 늦은 성공을 시간 초과 실패로 보고 재시도하면 같은 알림이 2~3번 전달된다.
- 시간 초과 재시도는 실제로 실패한 발송(어댑터 오류, 예: ETIMEDOUT)에만 적용한다. 재시도 횟수·간격 정책은 약화하지 않는다.
- 일반 발송(`src/retry/policy.js`의 `decide`)과 요약 발송(`src/digest/deadline.js`의 `withDeadline`) 모두 해당한다. 메일이 푸시보다 느려 더 자주 드러난다.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

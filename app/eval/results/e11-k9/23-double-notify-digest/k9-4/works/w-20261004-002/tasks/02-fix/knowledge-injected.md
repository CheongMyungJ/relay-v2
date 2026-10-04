## docs/knowledge/delivery/success-before-timeout.md (Work w-20261004-001에서 남김. 기준 브랜치에는 아직 없다)

---
kind: pitfall
source: investigation
anchor: decide
---
# 발송 판정은 성공 여부를 걸린 시간보다 먼저 본다

## 내용
- 제한 시간(메일 2000ms, 요약 3000ms)을 넘겨 성공한 발송을 시간 초과로 보고 재시도하면 같은 알림이 두 번(재시도가 또 느리면 세 번) 나간다. 2026-10-04에 이 때문에 중복 발송이 났다.
- 판정은 `outcome.ok`를 먼저 보고, 시간 초과는 실패한 발송에만 적용한다: `src/retry/policy.js`의 `decide`, `src/digest/deadline.js`의 `withDeadline`(느린 성공은 `slow: true`로만 표시).
- 메일이 더 자주 겪는다: SMTP 지연이 푸시보다 길어 제한 시간을 넘기기 쉽다.
- 재현·방지 테스트: `test/notifier.test.js`, `test/digest.test.js` 끝부분.

## 바뀐 이력
- 2026-10-04 처음 남김 (Work w-20261004-001)

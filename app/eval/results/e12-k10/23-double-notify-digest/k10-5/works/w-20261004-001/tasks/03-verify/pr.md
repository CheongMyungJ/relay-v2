# 성공한 발송이 제한 시간을 넘겨도 재시도하지 않게 수정

## 요약
일부 고객이 같은 알림(특히 메일)을 두세 번 받던 문제를 고친다. 느리게 성공한 발송을 시간 초과 실패로 보고 다시 보내던 것이 원인이다.

## 원인
- `src/retry/policy.js` `decide()`가 `elapsedMs > timeoutMs`를 `outcome.ok`보다 먼저 검사해 성공한 발송도 `retry-scheduled`로 처리했다.
- `src/digest/deadline.js` `withDeadline()`은 성공 뒤에도 시간이 넘으면 던졌고, `runner.js`는 원장에 기록하지 않고 재시도했다.
- 메일은 SMTP 중계라 지연이 커서 푸시보다 자주 걸린다.

## 변경
- `decide()`: 성공이면 소요 시간과 무관하게 `done`. 실패의 시간 초과 재시도는 유지.
- `withDeadline()`: 성공은 던지지 않고 `slow: true`로 알리고, `runner.js`가 `digest.send.slow` 지표를 올린다.
- 재시도 기능과 횟수는 그대로다.
- `docs/knowledge/delivery/`에 관련 지식 2건 추가.

## 테스트
- `npm test`: 80개 모두 통과.
- 신규 `test/duplicate-send.test.js` 6개: 느린 메일·느린 푸시·느린 요약은 한 번만 발송(수정 전 3개 실패), 실제 실패한 메일·요약은 재시도되어 전달.

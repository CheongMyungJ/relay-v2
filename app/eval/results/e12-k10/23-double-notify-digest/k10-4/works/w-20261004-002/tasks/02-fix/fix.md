## 재현
- 재현 절차: `node --test test/digest-duplicate.test.js` (수정 전 코드에서). 메일 지연 5000ms(제한 3000ms)인 사용자 1명의 요약을 `notifier.digest.tick()`으로 보낸다.
- 결과: 재현됨
- 기대: 메일 1통
- 실제: 메일 3통 (`mail.sent.length` 3). 같은 기간을 `run()`으로 두 번 돌리면 2통.

## 원인
- 원인: (1) `withDeadline`이 발송이 성공한 뒤 걸린 시간이 `sendTimeoutMs`를 넘으면 `SendTimeoutError`(transient)를 던져, 이미 전달된 요약을 실패로 보고 `maxAttempts`(3)까지 재발송한다. (2) `digestKey`에 `runId`가 들어가 실행이 다르면(재실행·재시작·다른 서버) 이미 보낸 키를 못 알아봐 또 보낸다.
- 근거: `src/digest/deadline.js` 시간 검사 후 throw, `src/digest/key.js` 키 형식 `digest:${period}:${runId}:${userId}`. 수정 전 재현 테스트 1·2번 실패(3통, 2통). 지연 300ms인 기존 테스트는 제한을 안 넘어 통과해 가려졌다. 누락 쪽: `scheduler.js`가 `run()` 전에 `lastPeriod`를 먼저 정해, `run()`이 예외를 내거나 일시 오류로 포기하면 그 날은 다시 안 돌고, tick이 없던 날은 건너뛴다. 테스트 3·4·5 수정 전 실패.
- 사람 추정 판정: 없음
- 기각한 가설: 팀 지식 항목(`slow-success-is-not-timeout.md`)의 `retry/policy.js` 문제 — 요약 경로는 `retry/`를 쓰지 않고 `digest/runner.js`의 자체 재시도를 쓰므로 해당 없음(그 항목은 앞 Work에서 고쳤을 수 있음, 머지 대기).

## 변경 요약
- `src/digest/deadline.js` — 성공을 시간 초과로 뒤집지 않고 걸린 시간만 잰다.
- `src/digest/key.js`, `runner.js` — 키에서 runId 제거(실행별 집계는 ledger의 runId로 계속 가능). 요약에 `retryable`(일시 오류로 포기한 수) 추가.
- `src/digest/inbox.js` — `nextPeriod` 추가.
- `src/digest/scheduler.js` — 예외·일시 오류로 남은 기간은 다음 tick에 다시 돌고(최대 maxAttempts회), 놓친 날은 keepDays 안에서 이어서 보낸다. 겹친 tick 방지.
- 기존 테스트 변경 없음.

## 재현 테스트
- 위치: `test/digest-duplicate.test.js` (5개)
- 수정 전: 실패 (`node --test test/digest-duplicate.test.js` → 5개 모두 not ok, 예: expected 1 actual 3)
- 수정 후: 통과 (같은 명령, 5개 ok)

## 테스트 실행
- 명령: `npm test`
- 결과: 79개 통과, 0 실패 (기존 74 + 신규 5)
- 실패 항목: 없음

## 재현
- 재현 절차: `test/digest.test.js`에 추가한 테스트를 수정 전 코드에서 실행: `node --test test/digest.test.js`. (메일 지연 3500ms, 제한 `digest.sendTimeoutMs`=3000ms로 요약 실행 / 같은 기간을 runId만 바꿔 두 번 실행)
- 결과: 재현됨
- 기대: 느리지만 성공한 요약은 1번 발송·`sent` 1건. 같은 기간 재실행은 `already`로 건너뜀.
- 실제: 메일이 3번 호출되고(maxAttempts=3) 요약은 `failed`로 끝남. 재실행(run-b)은 이미 보낸 사용자에게 다시 발송(`already` 0).

## 원인
- 원인: (1) `withDeadline`이 어댑터 호출이 성공한 뒤에도 걸린 시간이 제한을 넘으면 `SendTimeoutError`(transient)를 던져, 이미 도착한 요약이 재시도로 2~3번 더 발송됐다. (2) 보낸 키 `digestKey`에 `runId`가 들어 있어(기본 runId는 실행 시각) 같은 기간을 다시 실행하면(재시작·수동 실행·다중 서버) 이전 발송 기록에 걸리지 않고 또 발송됐다.
- 근거: `src/digest/deadline.js` 수정 전 `elapsedMs > timeoutMs`이면 throw, `runner.js`의 catch가 `isTransient`이면 재시도. 성공 시에만 `ledger.markSent`가 불리므로 재시도 때 키가 없어 재발송. 수정 전 테스트 3건 실패(10, 12, 13번), 수정 후 전부 통과 — 고쳐서 사라지는 것을 실험으로 확인. 응답이 느린 메일에서만 발생하고 maxAttempts가 3이라 "두 통, 가끔 세 통"과 맞다. 빠른 발송(300ms)은 영향 없음(기존 테스트 통과).
- 사람 추정 판정: 없음
- 기각한 가설: 재시도 횟수·정책 자체가 문제 — 실패 건의 재시도는 의도된 동작이며 비목표라서 유지(`시간 초과 오류로 실패한 요약은 다시 보낸다` 테스트로 보존). 일정(`scheduler.lastPeriod`)이 하루에 두 번 돈다 — 한 프로세스에서는 `lastPeriod`로 막혀 기존 테스트가 통과함(재시작 시 재실행은 원인 (2)로 덮음).

## 변경 요약
- src/digest/deadline.js — 성공한 호출은 시간을 넘겨도 던지지 않고 `slow` 표시를 돌려준다. 어댑터가 던진 오류는 그대로 전파.
- src/digest/runner.js — `slow`면 경고 로그와 ledger 항목에 `slow: true`만 남기고 성공 처리. 키에서 runId 제거.
- src/digest/key.js — 키를 `digest:<period>:<userId>`로. 실행별 건수는 ledger의 runId로 계속 센다(`runSummary`).
- test/digest.test.js — 테스트 4건 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/digest.test.js 마지막 4개 테스트(느린 성공 1회 발송, 시간 초과 오류 실패 재시도, runId 달라도 재발송 없음, 건너뛰기 없음)
- 수정 전: 실패 — `node --test test/digest.test.js` → 3건 실패(느린 성공, runId 재실행, 건너뛰기 없음), 재시도 보존 테스트는 통과(보존 확인용)
- 수정 후: 통과 — 같은 명령, 13건 모두 통과

## 테스트 실행
- 명령: `npm test`
- 결과: 78건 통과, 0건 실패
- 실패 항목: 없음

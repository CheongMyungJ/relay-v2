## 재현
- 재현 절차: `test/digest.test.js`의 새 테스트를 수정 전 `src/`에서 실행 — `git checkout 6ea77c6 -- src && node --test test/digest.test.js` (재현용 입력: 메일 지연 4000ms(>sendTimeoutMs 3000ms) 또는 같은 기간 `run()` 두 번)
- 결과: 재현됨
- 기대: 같은 고객·같은 날짜 요약은 메일 1통
- 실제: 느린 성공 → 같은 요약 3통(maxAttempts 3), 같은 기간 재실행 → 실행마다 1통 더, 겹친 실행 → 2통

## 원인
- 원인: (1) `src/digest/key.js`가 중복 방지 키에 `runId`를 넣어, 재시도 외의 재실행·수동 실행·재시작 때 키가 달라 ledger가 중복을 못 막는다. (2) `src/digest/deadline.js`는 발송이 성공한 뒤 걸린 시간이 제한(3000ms)을 넘으면 성공 결과를 버리고 transient 시간 초과를 던진다. 메일은 이미 나갔는데 `runner.js`가 재시도해 maxAttempts(3)만큼, 즉 최대 3통이 나간다. 이것이 "가끔 3통"의 단서다.
- 근거: 수정 전 새 테스트 4건 실패(지연 4000ms로 mail.sent 3통 등). 수정 후 통과. deadline.js의 throw는 `fn()` 완료 뒤에 있어 발송 성공과 무관하게 던진다(deadline.js:15-19 원본). 느린 성공은 이미 ledger에 안 남아 재시도에서 `ledger.has`도 통과한다. 겹친 실행은 `has` 확인과 `markSent` 사이에 await가 있어 둘 다 통과한다.
- 사람 추정 판정: "3통이 나오는 조건이 원인의 단서" — 맞음 — 3통은 느린 성공이 maxAttempts만큼 반복되는 경우와 맞고, 2통은 재실행이나 느린 성공 1회 뒤 성공과 맞는다.
- 기각한 가설: 일반 알림용 `src/retry/`(queue/worker/policy)와 `src/dedupe/` 공유 — 요약 runner는 이를 쓰지 않고(`createDigestRunner`에 retry 큐 없음) 자체 루프로 재시도하므로 기각. 스케줄러가 같은 기간을 두 번 돌린다 — `lastPeriod`가 await 전에 설정돼 한 프로세스 안에서는 막혀 기각(재시작·다중 서버는 키 수정으로 ledger가 막음).

## 변경 요약
- src/digest/key.js — 키에서 runId 제거(`digest:기간:사용자`). 실행별 집계는 ledger entry의 runId로 유지.
- src/digest/deadline.js — 제한 초과해도 성공 결과를 버리지 않고 `slow` 플래그만 반환.
- src/digest/runner.js — 키 변경 반영, 발송 중 키 `inFlight`로 겹친 실행의 동시 발송 방지, 느린 발송 경고 로그. 재시도 로직(maxAttempts, retryDelayMs, transient 판정)은 그대로.
- test/digest.test.js — 경로별 테스트 6건 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/digest.test.js 끝의 `중복 방지(...)` 6건
- 수정 전: 실패 — `git checkout 6ea77c6 -- src && node --test test/digest.test.js` → 4건 실패(최초 발송/느린 재시도/스케줄러 재실행/겹치는 실행), 나머지 2건(재시도 후 전달, 실패 뒤 재전달)은 통과(회귀 보호용)
- 수정 후: 통과 — `node --test test/digest.test.js` → 15 pass, 0 fail

## 테스트 실행
- 명령: `npm test`
- 결과: 80 pass, 0 fail (기존 74 + 신규 6)
- 실패 항목: 없음

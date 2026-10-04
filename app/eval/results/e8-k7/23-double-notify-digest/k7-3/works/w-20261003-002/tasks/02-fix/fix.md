## 재현
- 재현 절차: `test/digest.test.js`에 추가한 시험을 수정 전 `src/`로 실행: `git checkout 5eb5870 -- src && npm test`. 예) 메일 어댑터가 3500ms 걸려 성공(`mail: { outcomes: [{ latencyMs: 3500 }] }`)하게 하고 `notifier.digest.tick()`을 부른다. 또는 같은 기간에 `notifier.digest.run({ period })`를 두 번 부른다.
- 결과: 재현됨
- 기대: 사용자 한 명에게 요약 메일이 하루(기간)에 한 통만 나간다(`mail.sent.length === 1`).
- 실제: 느린 성공 → 같은 실행에서 `maxAttempts`(3)번까지 보내 3통. 재실행 → 실행마다 한 통씩 더 나간다.

## 원인
- 원인: 중복 경로가 둘이다. (1) `withDeadline`이 성공했지만 `sendTimeoutMs`(3000ms)보다 오래 걸린 발송을 `SendTimeoutError`(transient)로 던져, 이미 전달된 요약을 runner가 실패로 보고 기록(`markSent`) 없이 다시 보냈다. (2) 요약 키 `digestKey`에 `runId`가 들어 있어 재실행·재시작·수동 실행은 키가 달라져 `ledger.has`가 이전에 보낸 요약을 알아보지 못했다.
- 근거: `src/digest/deadline.js:17-19`(수정 전)가 느린 성공을 던짐, `src/digest/runner.js:57`이 transient면 재시도, 성공 기록은 `:52` try 안이라 던지면 건너뜀. `src/digest/key.js:8`(수정 전) 키에 runId 포함. 수정 전 코드에서 시험 5개 실패(느린 성공 2, 재실행 2, 이틀 연속 1), 수정 뒤 모두 통과. 메일 지연 300ms(기본)일 때는 재현되지 않는 것도 시험으로 확인(기존 시험 통과) — "가끔" 세 통은 발송이 느린 날에만 나는 조건과 맞는다. 재시작 시 `scheduler.lastPeriod`가 메모리에만 있어 같은 기간을 새 runId로 다시 보내는 경로도 (2)에 해당한다.
- 사람 추정 판정: 없음
- 기각한 가설: 실패한 요약을 일정이 두 번 부른다 — `scheduler.tick`은 `lastPeriod`를 `await` 전에 정해 같은 프로세스에서는 겹쳐 돌지 않음. 재시도 전체 끄기·발송 건너뛰기 — 비목표(증상만 가림).

## 변경 요약
- src/digest/deadline.js — 제한 시간을 넘긴 성공을 던지지 않고 `slow: true`로만 알린다(팀 지식 slow-success-is-success). 던져진 실제 오류는 그대로 전달.
- src/digest/runner.js — `slow`면 `digest.send.slow` 지표와 경고 로그만 남긴다. 키에서 runId 제외.
- src/digest/key.js — 키를 `digest:<기간>:<사용자>`로 바꿈. runId는 기록(entry.runId)에 남아 실행별 집계(`runSummary`)는 그대로.
- test/digest.test.js — 시험 7개 추가(기존 시험은 바꾸지 않음).

## 재현 테스트
- 위치: test/digest.test.js (뒤쪽 `[경로: …]`, `[하루 건너뛰기 없음]` 7개)
- 수정 전: 실패 — `git checkout 5eb5870 -- src && npm test` → 5개 실패(느린 성공 2, 재실행 2, 이틀 연속 1), `# pass 76 # fail 5`
- 수정 후: 통과 — `npm test` → `# pass 81 # fail 0`
- 경로별 근거 요약:
  - 정기 실행(tick): 하루 한 번(`lastPeriod`)이고 기록 키로 한 번 더 막힘 — 기존 시험 + 이틀 연속 시험
  - 느린 성공: 성공이면 즉시 기록, 재시도 없음 — 느린 성공 시험 2개
  - 오류 재시도: 일시적 오류만 재시도, 성공하는 순간 기록해 이후 다시 안 보냄 — 재시도 시험(2회 실패 뒤 한 통)
  - 재실행·수동 실행·재시작: 키가 기간+사용자라 이미 보낸 요약은 `already` — 재실행 시험 2개
  - 포기(영구 오류)한 요약: 기록되지 않아 다음 실행에서 다시 보내짐 — 시험 1개
  - 하루 건너뛰기 없음: 이틀 연속 시험(느린 첫날 포함)

## 테스트 실행
- 명령: `npm test`
- 결과: 81개 통과, 0개 실패
- 실패 항목: 없음

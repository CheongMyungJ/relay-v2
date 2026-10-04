## 재현
- 재현 절차: `node --test test/digest.test.js` (수정 전 코드에서 새로 추가한 테스트 10~16번이 실패). 예) 요약 메일 발송이 3.5초 걸려 성공하도록 가짜 전송을 설정(`outcomes: [{ latencyMs: 3500 }]`)하고 `notifier.digest.tick()`을 부른다.
- 결과: 재현됨
- 기대: 메일 서버가 받은 요약은 같은 날 같은 고객에게 1통
- 실제: 3.5초 걸린 성공이 시간 초과로 처리돼 60초 뒤 재전송 → 최대 3통(maxAttempts). 같은 기간을 다시 `run()`하거나 실행이 겹치면 runId만 달라 또 발송.

## 원인
- 원인: 요약이 두 번 이상 나가는 경로가 여럿이다. (1) `withDeadline`이 성공한 발송도 3초를 넘기면 `SendTimeoutError`(transient)로 던져 재시도된다. (2) 발송 기록 키에 runId가 있어(`digestKey`) 재실행·다른 서버·겹친 실행은 이미 보냈는지 못 본다. (3) 겹친 실행은 `ledger.has` 확인과 `markSent` 사이 await 때문에 같은 사용자를 동시에 보낸다.
- 누락 원인: 일정이 `lastPeriod`를 실행 전에 올려서 실행이 오류로 끝나면 그 날은 다시 시도되지 않고, 일정이 하루 돌지 못하면 전날 기간만 보므로 놓친 기간은 영영 안 나간다.
- 근거: `src/digest/deadline.js`(수정 전) 값 반환 뒤 elapsed 검사, `src/digest/key.js:8` runId 포함, `src/digest/scheduler.js`(수정 전) `lastPeriod = period` 가 `runner.run` 앞. 수정 전 새 테스트 6개 실패(10,11,12,13,15,16), 수정 후 전부 통과 — 코드를 고쳐 실험함. 재시도가 (발송 시간 + 60초) 뒤라 중복이 수 초~분 늦게 오는 것도 (1)과 맞는다. 요약이 나가는 경로 중 느린 응답이 없으면 재현되지 않는다는 조건도 (1)로 설명된다.
- 사람 추정 판정: 없음
- 기각한 가설: 재시도 정책이 과해서 중복 — 실제 실패(421)는 한 번 재시도해 한 통만 나가는 것을 테스트로 확인, 비목표이므로 손대지 않음.

## 변경 요약
- src/digest/deadline.js — 성공은 시간과 무관하게 성공. 던지지 않고 `slow` 표시만 돌려준다(팀 지식 retry/success-is-success-regardless-of-time과 같은 유형).
- src/digest/key.js — 키를 `digest:기간:사용자`로(runId 제거). 실행별 집계는 ledger의 runId로 유지.
- src/digest/runner.js — 키가 `inFlight`이면 건너뜀(겹친 실행). 느린 성공은 경고 로그만.
- src/digest/scheduler.js — 기간은 실행이 성공해야 올림, 놓친 지난 기간도 차례로 발송, 일정 중복 호출 방지.
- README.md — 키 설명 갱신.
- 기존 테스트 변경: 없음(추가만).

## 재현 테스트
- 위치: test/digest.test.js 10~17번 (처음 발송/재시도/재실행/동시 실행/실패 재발송/건너뛰기 2종/일정 겹침)
- 수정 전: 실패 — `git stash`로 src만 되돌리고 `node --test test/digest.test.js`: 10,11,12,13,15,16 not ok (fail 6). 14(실패 시 재발송)와 17은 기존 동작 보존 확인용이라 통과.
- 수정 후: 통과 — `npm test`: pass 82, fail 0

## 테스트 실행
- 명령: `npm test`
- 결과: 82 통과, 0 실패
- 실패 항목: 없음

## 재현
- 재현 절차: `npm test`에 추가한 테스트 3건(`test/digest.test.js` 끝부분)이 수정 전 실패. 예: `digestSetup({ mail: { outcomes: [{ latencyMs: 5000 }] } })`로 한 명의 요약을 `tick()`하면 메일이 여러 번 나감.
- 결과: 재현됨
- 기대: 같은 날 같은 요약은 메일 1통
- 실제: (1) 5초 걸려 성공한 발송이 시간 초과로 처리되어 maxAttempts까지 재발송 (2) 같은 기간을 `run()`으로 다시 실행하면 새 runId로 다시 발송

## 원인
- 원인: 두 가지가 겹쳤다. (1) `withDeadline`이 성공한 발송도 `sendTimeoutMs`(3000ms)를 넘기면 timeout 오류로 던져 runner가 재시도 → 이미 나간 메일이 2~3통. (2) `digestKey`에 runId가 들어 있어 실행이 다르면(재실행, 수동 실행) 키가 달라 발송 기록 확인(`ledger.has`)이 중복을 못 막음.
- 근거: `src/digest/deadline.js` (수정 전) 성공 뒤 `elapsedMs > timeoutMs`면 throw, `src/digest/runner.js`의 catch가 `isTransient`(timeout은 transient)로 재시도. `src/digest/key.js` 수정 전 키 `digest:${period}:${runId}:${userId}`. 수정 전 테스트 3건 실패, 수정 후 통과(실험).
- 사람 추정 판정: 없음
- 기각한 가설: 재시도 횟수/기능이 문제 — 비목표이며, 실제 실패는 재발송돼야 하므로 원인이 아님. 스케줄러(`lastPeriod`) 중복 실행 — 같은 프로세스에선 하루 한 번만 돎(기존 테스트 확인). 재시작 시 `lastPeriod` 초기화는 발송 기록(운영에선 공유 DB) 키로 막는다.

## 변경 요약
- src/digest/deadline.js — 성공은 걸린 시간과 무관하게 성공으로 반환. 시간 제한은 실패한 발송에만 적용.
- src/digest/key.js — 키에서 runId 제거(`digest:기간:사용자`). 실행별 집계는 ledger 항목의 runId로 그대로 가능.
- src/digest/runner.js — 새 키 시그니처 사용.
- test/digest.test.js — 테스트 4건 추가(기존 테스트 변경 없음).

## 경로별 한 번 발송 근거
- 스케줄러 `tick()`: 하루 한 번(`scheduler.js` lastPeriod) + 발송 키 확인. 테스트 '일정은 ... 하루 한 번만 돈다'.
- 같은 실행 내 재시도: 실패(일시 오류)만 `again`에 들어가고 성공은 재시도 안 됨. 테스트 '느리지만 성공한…', '일시적 오류는 잠시 뒤…'.
- 재실행/수동 `digest.run()`: 키가 runId와 무관해 `ledger.has`로 건너뜀(`already`). 테스트 '같은 기간을 다시 실행해도…'.
- 실제 실패: 재시도 및 재실행에서 재발송, 결국 1통. 테스트 '실패한 요약은 재실행에서…', '실제로 실패한 요약만…'.

## 재현 테스트
- 위치: test/digest.test.js (마지막 4건)
- 수정 전: 실패 — `npm test`: 3건 not ok(33,34,35), 나머지 1건은 수정 전에도 통과(느린 실패 회귀 방지용)
- 수정 후: 통과 — `npm test` 78 pass, 0 fail

## 테스트 실행
- 명령: `npm test`
- 결과: 78 pass / 0 fail
- 실패 항목: 없음 (기준 커밋에서도 74 pass)

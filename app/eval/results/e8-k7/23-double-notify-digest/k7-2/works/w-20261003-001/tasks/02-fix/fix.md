## 재현
- 재현 절차: `node --test test/duplicate-send.test.js` (수정 전 코드에서). 가짜 메일 transport를 `latencyMs: 2500`(제한 시간 `send.timeoutMs` 2000ms 초과)으로 두고 `notifier.handle(shippedEvent())` 후 `retryWorker.runDue()`를 돌린다.
- 결과: 재현됨
- 기대: 느려도 성공한 메일은 한 번만 도착(`mail.sent.length === 1`), 재시도 대기열 비어 있음
- 실제: 성공했는데 `retry-scheduled`로 처리되어 재시도 때 같은 메일이 한 번 더 감. 최대 시도 3회라 최대 3통

## 원인
- 원인: `decide()`가 성공 여부보다 먼저 `elapsedMs > timeoutMs`를 검사해, 이미 도착한 발송도 시간 초과로 보고 재시도한다. 요약 메일은 `withDeadline()`이 성공 뒤에 시간 초과 오류를 던져 같은 일이 생기고, 요약 키에 `runId`가 들어 있어 재실행 시 이미 보냈는지 걸러내지 못한다.
- 근거: `src/retry/policy.js` 16~18행(수정 전) 시간 검사가 `outcome.ok` 앞에 있음. `src/digest/deadline.js` 수정 전 `fn()` 성공 뒤 throw. `src/digest/key.js` 수정 전 `runId` 포함, `runner.js`는 매 실행 새 `runId`를 만듦. 메일 기본 지연 400ms·요약 300ms는 기준 안이라 평소엔 안 생기고, 중계 서버가 느릴 때만 생기며 메일 지연이 더 커서 메일에서 잦음. 실험: 수정 전 테스트 5개 실패, 수정 후 통과.
- 사람 추정 판정: 없음 (요청에 의심 위치 없음)
- 기각한 가설: 중복 제거(dedupe) 키 문제 — `dedupeKey`는 같은 이벤트를 걸러내며 문제 재현 경로(한 번 받은 이벤트의 재시도)와 무관함. 재시도 횟수·간격 정책 — 실제 실패는 정상 재시도하는 것이 맞고 정책은 건드리지 않음.

## 변경 요약
- src/retry/policy.js — 성공(`outcome.ok`)이면 걸린 시간과 관계없이 `done`. 실패인 경우에만 시간 초과를 사유로 삼음
- src/digest/deadline.js — 성공한 발송을 시간 초과 오류로 바꾸지 않고 `slow` 플래그만 돌려줌
- src/digest/runner.js — `slow`면 `digest.slow` 지표 증가
- src/digest/key.js — 키에서 `runId` 제거. 실행별 집계는 기록의 `runId` 필드로 가능
- 기존 테스트 변경 없음

## 재현 테스트
- 위치: test/duplicate-send.test.js (6개: 정책, 메일, 푸시, 실제 시간 초과 재시도 유지, 요약 느린 성공, 요약 재실행)
- 수정 전: 실패 — `node --test test/duplicate-send.test.js` → pass 1 / fail 5 (실제 실패 재시도 테스트만 통과)
- 수정 후: 통과 — 같은 명령 6개 모두 통과

## 테스트 실행
- 명령: `npm test`
- 결과: 80개 통과, 0 실패
- 실패 항목: 없음

## 재현
- 재현 절차: `node --test test/duplicate-send.test.js` (가짜 메일 transport에 `latencyMs: 3000`(바로 보내기, 제한 2000ms) 또는 `5000`(요약, 제한 3000ms)을 주고 가상 시계로 재시도 실행)
- 결과: 재현됨
- 기대: 성공한 발송은 한 번만 나가고 재시도 대기열이 비어 있다
- 실제: 메일이 성공했는데도 `retry-scheduled`가 되어 재시도 때 다시 발송됨. 요약도 성공 뒤 시간 초과 오류로 바뀌어 다시 발송됨 (재시도 최대 3회까지 가서 "가끔 세 번")

## 원인
- 원인: 성공한 발송이라도 걸린 시간이 제한 시간을 넘으면 실패(시간 초과)로 바꿔 재발송하는 판정이 두 곳에 있다. 이미 전달된 메일을 다시 보낸다. 메일은 응답이 느려 제한 시간을 넘기기 쉬워 더 자주 나타난다.
- 근거: `src/retry/policy.js`의 `decide`가 `outcome.ok`보다 `elapsedMs > timeoutMs`를 먼저 검사함. `src/digest/deadline.js`의 `withDeadline`이 `fn()` 성공 뒤 `elapsedMs > timeoutMs`면 `SendTimeoutError`(transient)를 던지고 runner가 재시도함. 두 곳 모두 고치기 전 재현 테스트 3건 실패, 고친 뒤 통과. 푸시는 지연 80ms라 제한을 거의 넘지 않아 덜 나타남.
- 사람 추정 판정: 없음
- 기각한 가설: 메일 어댑터가 타임아웃을 던졌는데 실제론 전달됨(t-01 가설) — 어댑터의 `ETIMEDOUT`은 실제 오류로 던져진 것이라 재시도가 정책상 맞고, 이번에 재현된 중복은 성공 응답을 받고도 재발송한 것이라 다른 원인. 이 모호성(전달 여부를 알 수 없는 시간 초과)은 멱등 키 없이는 해결 불가라 이번 범위 밖으로 둠.

## 변경 요약
- src/retry/policy.js — `outcome.ok`이면 걸린 시간과 상관없이 `done`. 실패 시 시간 초과 판정과 재시도 정책은 그대로.
- src/digest/deadline.js — 성공을 시간 초과로 뒤집지 않고 걸린 시간만 잼. 실제 던져진 오류는 그대로 runner에 전달.
- test/duplicate-send.test.js — 신규 테스트.

## 재현 테스트
- 위치: test/duplicate-send.test.js (4건: decide 단위, 느린 메일 바로 보내기, 실패 시 재시도 유지, 느린 요약 메일)
- 수정 전: 실패 — `node --test test/duplicate-send.test.js` → pass 1 / fail 3 (실패 재시도 테스트만 통과)
- 수정 후: 통과 — 4건 모두 통과

## 테스트 실행
- 명령: `npm test`
- 결과: 78건 중 78 통과, 0 실패
- 실패 항목: 없음

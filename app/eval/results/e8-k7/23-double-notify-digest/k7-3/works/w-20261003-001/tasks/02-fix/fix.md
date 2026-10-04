## 재현
- 재현 절차: `node --test test/duplicate-send.test.js` (수정 전 코드에서 실행). 가짜 전송의 `outcomes: [{ latencyMs: 2500 }]`로 "전달은 됐지만 응답이 send.timeoutMs(2000ms)보다 늦은" 발송을 만든 뒤 재시도 워커를 돌린다. 요약 메일은 `latencyMs: 3500`(요약 제한 3000ms).
- 결과: 재현됨
- 기대: 전달에 성공한 발송은 재시도하지 않아 전송이 한 번만 일어난다.
- 실제: 메일·푸시·요약 메일 모두 응답이 늦으면 성공했는데도 재시도되어 같은 알림이 다시 나간다(최대 maxAttempts=3회, 즉 두 번 또는 세 번).

## 원인
- 원인: 발송 결과를 판정할 때 성공 여부보다 걸린 시간을 먼저 본다. 성공했어도 제한 시간을 넘기면 `timeout`으로 보고 재시도 대기열에 넣거나(일반 발송), 예외를 던져 다시 보낸다(요약). 이미 전달된 알림이 다시 발송된다.
- 근거: `src/retry/policy.js`의 `decide()`가 `elapsedMs > timeoutMs`를 `outcome.ok`보다 먼저 검사해 성공도 `retry`로 돌렸다. `src/digest/deadline.js`의 `withDeadline()`은 `fn()`이 성공한 뒤에도 시간이 넘으면 `SendTimeoutError`를 던졌고, `runner.js`가 이를 일시적 오류로 보고 다시 보냈다(요약 보낸 키는 성공 때만 기록되어 중복 방지도 작동하지 않음). 수정 전 재현 테스트 3건 실패, 수정 후 통과. 메일이 더 잦은 이유(추정): 가짜 전송 기본 지연이 메일 400ms, 푸시 80ms로 메일이 제한 시간에 더 가깝고 SMTP 중계가 느리다. 운영 지연 분포는 확인 못 함.
- 사람 추정 판정: 없음 (요청에 원인 추정 없음)
- 기각한 가설: 수신 중복 제거(`dedupe/key.js`) 결함 — 같은 이벤트 동시 수신 시 한 번만 발송됨을 기존 테스트가 보장하고, 이 재현은 중복 수신 없이 발생함. 재시도 큐에서 같은 job이 두 번 나옴 — `takeDue`가 shift로 꺼내므로 중복 없음.

## 변경 요약
- src/retry/policy.js — `outcome.ok`면 소요 시간과 관계없이 `done`을 돌려주도록 순서 변경. 실패한 발송의 시간 초과·재시도 정책은 그대로.
- src/digest/deadline.js — 성공한 호출은 제한 시간을 넘겨도 예외 없이 값을 돌려주고 `slow` 플래그만 알린다.
- src/digest/runner.js — `slow`면 `digest.send.slow` 지표를 올려 느린 발송을 계속 볼 수 있게 함.
- test/duplicate-send.test.js — 신규 회귀 테스트(아래).

## 재현 테스트
- 위치: test/duplicate-send.test.js (6건: 느린 성공 메일/푸시/요약 3건, 실제 실패는 재시도되는 메일 transient·푸시 timeout·요약 timeout 3건)
- 수정 전: 실패 — `node --test test/duplicate-send.test.js` → 느린 성공 3건 not ok, 재시도 유지 3건 ok (pass 3, fail 3)
- 수정 후: 통과 — 같은 명령 6건 모두 통과

## 테스트 실행
- 명령: `npm test`
- 결과: tests 80, pass 80, fail 0 (기존 74 + 신규 6). 기존 테스트는 변경하지 않음.
- 실패 항목: 없음

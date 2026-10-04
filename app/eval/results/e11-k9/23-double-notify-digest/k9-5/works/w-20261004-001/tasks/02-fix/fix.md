## 재현
- 재현 절차: `npm test` (추가한 테스트가 수정 전 코드에서 실패). 가짜 메일 transport에 `latencyMs: 3000`(제한 2000ms 초과)을 주고 `notifier.handle(shippedEvent())` 호출; 요약은 `digestSetup({ mail: { latencyMs: 3500 } })`로 `digest.tick()` 호출
- 결과: 재현됨
- 기대: 메일이 실제로 나갔으면 성공 1회, 재시도 없음 (`mail.sent.length === 1`)
- 실제: 즉시 발송은 성공했는데도 `retry-scheduled`로 처리되어 재시도 때 다시 발송됨. 요약은 `summary.sent`가 0이고 발송 후 실패로 기록되어 재시도 때 또 발송됨

## 원인
- 원인: 발송이 끝내 성공했어도 걸린 시간이 제한 시간을 넘으면 "시간 초과"로 보고 재시도했다. 이미 나간 메일/푸시를 다시 보내므로 중복이 된다. 응답이 느린 채널(메일은 기본 지연 400ms, 느려지면 수 초)에서 더 자주 난다.
- 근거: `src/retry/policy.js:15` `decide()`가 `outcome.ok`보다 `elapsedMs > timeoutMs`를 먼저 검사. `src/digest/deadline.js` `withDeadline`이 성공한 뒤에도 시간 초과 오류를 던짐(요약 경로, `runner.js`가 이를 일시 오류로 재시도). 두 경로 모두 느린 성공 테스트가 수정 전 실패, 수정 후 통과. 빠른 성공/실제 실패는 영향이 없어 "일부 고객만, 메일이 더 자주"와 맞음.
- 사람 추정 판정: 없음
- 기각한 가설: 재시도 워커가 같은 작업을 두 번 꺼냄 — `takeDue`가 shift로 꺼내므로 아님. dedupe 키/TTL 문제 — 재시도는 dedupe를 거치지 않으며 수신 중복은 별도 테스트로 정상 확인.

## 변경 요약
- src/retry/policy.js — `decide()`에서 성공(`outcome.ok`)을 시간 초과 검사보다 먼저 처리
- src/digest/deadline.js — 성공한 발송은 제한 시간을 넘어도 값을 돌려줌(더 이상 던지지 않음). 걸린 시간은 `elapsedMs`로 계속 제공
- test/notifier.test.js, test/digest.test.js — 테스트 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/notifier.test.js "제한 시간보다 오래 걸려도 성공한 발송은 다시 보내지 않는다", test/digest.test.js "제한 시간보다 오래 걸려도 보낸 요약은 다시 보내지 않는다". 재시도 유지 확인: notifier.test.js "실패하면 다시 보내고 끝내 성공하면 한 번만 전달된다"
- 수정 전: 실패 (`node --test` → fail 2: expected 1 / actual 0 등)
- 수정 후: 통과 (`node --test` → pass 77, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 77개 통과, 0 실패
- 실패 항목: 없음

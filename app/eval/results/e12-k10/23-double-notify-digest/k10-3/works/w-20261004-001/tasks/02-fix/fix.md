## 재현
- 재현 절차: `setup({ mail: { latencyMs: 2500 } })`(test/helpers.js)로 notifier를 만들고 `notifier.handle(shippedEvent())` 후 가상 시계를 10초씩 밀며 `notifier.retryWorker.runDue()`를 두 번 호출한다. 요약은 `digestSetup({ mail: { latencyMs: 5000 } })`로 알림 1건을 모으고 `clock.set(NEXT_MORNING)` 뒤 `notifier.digest.tick()`.
- 결과: 재현됨
- 기대: 메일 1통만 도착한다. 요약도 1통.
- 실제: 일반 발송은 메일이 3통 도착(`mail sent 3 calls 3`), 첫 결과가 `retry-scheduled / timeout`. 요약은 보낸 뒤 시간 초과로 처리되어 기록(ledger)에 남지 않고 다시 발송된다.

## 원인
- 원인: 어댑터가 성공(메일 접수)해도 걸린 시간이 제한(`send.timeoutMs` 2초, 요약은 `sendTimeoutMs` 3초)을 넘으면 실패(timeout)로 판단해 재시도 대기열/재발송으로 보낸다. 이미 고객에게 간 메일이 재시도 때마다 또 간다(최대 시도 3회 → 3통). 지연이 큰 메일 서버에서 더 자주 나타난다.
- 근거: `src/retry/policy.js`의 `decide`가 `elapsedMs > timeoutMs`를 `outcome.ok`보다 먼저 검사했다. `src/digest/deadline.js`의 `withDeadline`도 fn 성공 후 시간이 넘으면 `SendTimeoutError`를 던져 `runner.js`가 `markSent` 없이 재시도했다. 위 재현 외에 수정 뒤 같은 입력에서 1통만 가는 것을 확인했다(회귀 테스트). 지연이 제한 이내면 재현되지 않는 점도 설명된다(기존 테스트 통과). 푸시는 지연 80ms라 평소에는 안 걸린다.
- 사람 추정 판정: 없음
- 기각한 가설: 중복 이벤트 제거(dedupe) 실패 — 같은 이벤트 한 번 입력에서도 중복이 생기고, dedupe는 수신 단계에서만 쓰인다. 재시도 워커 동시 실행 — `takeDue`가 작업을 꺼내 제거하므로 같은 작업이 두 번 처리되지 않는다.

## 변경 요약
- src/retry/policy.js — `outcome.ok`를 시간 검사보다 먼저 처리해 성공이면 느려도 `done`. 실패한 발송의 시간 초과 재시도는 그대로.
- src/digest/deadline.js — 성공 후 시간 초과를 오류로 바꾸지 않고 `overrun` 플래그로 알린다.
- src/digest/runner.js — 느리게 성공해도 `markSent`로 기록하고 `digest.slow` 지표와 경고 로그를 남긴다.
- test/notifier.test.js, test/digest.test.js — 테스트 4개 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/notifier.test.js "제한 시간보다 늦게 성공한 메일은 다시 보내지 않는다", test/digest.test.js "제한 시간보다 늦게 성공한 요약은 다시 보내지 않는다". 실패 발송 재시도 확인: 각 파일의 "실제로 시간이 초과돼 실패한…", "시간 초과로 실제 실패한 요약은 다시 보낸다".
- 수정 전: 실패 (`npm test` → `not ok 33`, `not ok 59`, pass 76 / fail 2; 실패 재시도 테스트 2개는 통과)
- 수정 후: 통과 (`npm test` → pass 78 / fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: 78개 통과, 0개 실패
- 실패 항목: 없음

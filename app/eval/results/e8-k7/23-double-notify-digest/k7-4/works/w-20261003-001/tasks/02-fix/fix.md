## 재현
- 재현 절차: 새 테스트 3개를 수정 전 코드에서 실행한다. `npm test` (또는 `node --test test/retry.test.js test/notifier.test.js test/digest.test.js`). 가짜 메일/푸시 transport에 `latencyMs: 2500`(제한 시간 `send.timeoutMs` 2000ms 초과)을 주고 `notifier.handle(shippedEvent())` 후 재시도 워커를 돌린다. 요약은 `latencyMs: 3500`(`digest.sendTimeoutMs` 3000ms 초과)로 `notifier.digest.tick()`.
- 결과: 재현됨
- 기대: 발송이 성공하면 느려도 한 번만 전달된다.
- 실제: 성공한 발송이 `retry-scheduled`로 처리돼 재시도 때 한 번 더 전달된다(최대 `maxAttempts` 3회까지 → 두 번, 가끔 세 번). 요약 메일도 성공 후 시간 초과로 보고 `retryDelayMs` 뒤 다시 보낸다.

## 원인
- 원인: 어댑터 호출이 성공(메일 서버가 받아들임)했어도 걸린 시간이 제한 시간을 넘으면 실패(timeout)로 취급해 다시 보낸다. 이미 전달된 메시지를 재시도하므로 중복이 된다.
- 근거: `src/retry/policy.js` `decide()`가 `outcome.ok`보다 `elapsedMs > timeoutMs`를 먼저 검사해 `retry`를 돌려줌(수정 전 12~20줄). `src/digest/deadline.js` `withDeadline()`은 `fn()`이 성공한 뒤 경과 시간이 넘으면 `SendTimeoutError`를 던짐 → `runner.js`가 transient로 보고 재시도. 메일은 기본 지연(400ms)이 푸시(80ms)보다 길고 SMTP 중계가 느려 제한 시간을 넘기기 쉬워 더 자주 나타남. 빠르게 끝나면 재현되지 않는 조건과도 맞음. 실험: 수정 후 같은 입력에서 재현 테스트 통과, 수정 전 실패.
- 사람 추정 판정: 없음
- 기각한 가설:
  - 수신 중복 제거(dedupe) 결함 — `dedupeKey`/`checkAndMark`는 같은 이벤트를 한 번만 통과시키고 기존 테스트도 통과. 중복의 원인은 발송 단계의 재시도였음.
  - 요약 ledger 키에 runId 포함 — 같은 run 안에서는 `ledger.has`가 막아 주지만 성공 후 시간 초과 경로는 `markSent` 전에 예외가 나서 기록이 없었던 것이 문제. 별도 수정 없이 위 수정으로 해소.

## 변경 요약
- src/retry/policy.js — `outcome.ok`면 경과 시간과 무관하게 `done`을 먼저 돌려줌.
- src/digest/deadline.js — 성공한 `fn`은 느려도 값을 돌려줌(시간 초과 예외 제거, 경과 시간은 그대로 반환해 지표 유지). 실패는 어댑터가 던진 오류로 기존대로 재시도.
- test/retry.test.js, test/notifier.test.js, test/digest.test.js — 테스트 추가만 함(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/retry.test.js(느린 성공 → done), test/notifier.test.js(느리게 성공한 메일·푸시는 1회만), test/digest.test.js(느리게 성공한 요약은 1회만). 재시도 유지 확인용: 실패는 제한 시간을 넘겨도 retry, timeout 오류 실패는 재발송(notifier, digest).
- 수정 전: 실패 — `npm test` → 3개 실패(33 요약, 59 notifier, 72 retry), 재시도 확인용 테스트는 통과
- 수정 후: 통과 — `npm test` → pass 80, fail 0

## 테스트 실행
- 명령: npm test
- 결과: 80개 통과, 0개 실패
- 실패 항목: 없음

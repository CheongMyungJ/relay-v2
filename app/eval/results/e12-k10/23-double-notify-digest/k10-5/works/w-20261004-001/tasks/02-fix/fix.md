## 재현
- 재현 절차: `node --test test/duplicate-send.test.js` (수정 전 코드). 가짜 메일 transport를 `latencyMs: 3000`(일반 발송 제한 `send.timeoutMs` 2000ms 초과)으로 두고 `shippedEvent()`를 `notifier.handle`에 넣은 뒤 재시도 워커를 돌린다. 요약 경로는 `latencyMs: 4000`(요약 제한 `sendTimeoutMs` 3000ms 초과)으로 `notifier.digest.tick()`을 돈다.
- 결과: 재현됨
- 기대: 메일이 한 번만 발송된다.
- 실제: 발송은 성공했는데 `retry-scheduled`로 기록되고 재시도 때 같은 메일이 다시 나간다. 요약도 원장에 기록하기 전에 시간 초과로 던져 다시 보낸다. 최대 3회까지 나가므로 "가끔 세 번"과 맞는다.

## 원인
- 원인: 발송이 성공했어도 걸린 시간이 제한 시간을 넘으면 시간 초과 실패로 취급해 다시 보낸다. 메일 서버는 이미 메일을 받아서 보냈으므로 중복이 된다.
- 근거: `src/retry/policy.js` `decide()`가 `elapsedMs > timeoutMs`를 `outcome.ok`보다 먼저 검사했다. `src/digest/deadline.js` `withDeadline()`은 `fn()`이 성공한 뒤에도 시간이 넘으면 `SendTimeoutError`를 던졌고, `runner.js`는 예외 때 `ledger.markSent`를 하지 않고 재시도한다. 메일은 SMTP 중계라 지연이 커서 push보다 자주 걸린다(fake 기본 지연 메일 400ms, push 80ms). 수정 전 새 테스트 3개 실패, 수정 후 통과(조건 변경 실험).
- 사람 추정 판정: 없음
- 기각한 가설: 수신 중복 제거(`dedupe/key.js`)가 느슨하다 — 키는 id 등 이벤트 필드로 만들고 중복 수신은 `handle`에서 막힌다. 이번 증상(발송 후 재발송)을 설명하지 못한다. / 재시도 큐가 같은 job을 두 번 꺼냄 — `takeDue`는 shift로 꺼내므로 아니다.

## 변경 요약
- src/retry/policy.js — 성공(`outcome.ok`)이면 소요 시간과 무관하게 `done`. 실패일 때의 시간 초과 판정은 그대로.
- src/digest/deadline.js — 성공한 호출은 시간이 넘어도 던지지 않고 `slow: true`로 알림.
- src/digest/runner.js — `slow`면 `digest.send.slow` 지표를 올린다.
- test/duplicate-send.test.js — 신규 테스트 5개(기존 테스트는 변경 없음).

## 재현 테스트
- 위치: test/duplicate-send.test.js (중복 방지 3개, 실패 시 재시도 유지 2개)
- 수정 전: 실패 — `node --test test/duplicate-send.test.js` → 3 fail(정책 단위, 느린 메일, 느린 요약), 재시도 유지 2개는 통과
- 수정 후: 통과 — 같은 명령, 5개 모두 통과

## 테스트 실행
- 명령: `npm test`
- 결과: 79개 중 79 통과, 0 실패(기존 74 + 신규 5)
- 실패 항목: 없음

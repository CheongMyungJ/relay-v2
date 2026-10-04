## 재현
- 재현 절차: `node --test test/slow-success.test.js` (수정 전 코드에서). 가짜 메일 transport를 `latencyMs: 2500`(푸시·메일 공통 제한 `send.timeoutMs`=2000 초과)으로 두고 `notifier.handle(주문 발송 이벤트)` 호출. 요약은 `latencyMs: 3500`(`digest.sendTimeoutMs`=3000 초과)으로 `digest.tick()` 호출.
- 결과: 재현됨
- 기대: 전송이 성공했으면 1회 발송으로 끝나고 재시도 대기열은 비어 있다. 요약 메일도 1통.
- 실제: 성공했는데도 `retry-scheduled`가 되어 재시도 때 같은 메일이 또 나간다. 요약은 `mail.calls.length`가 2~3(maxAttempts까지).

## 원인
- 원인: 발송이 성공했어도 걸린 시간이 제한 시간을 넘으면 "시간 초과 실패"로 판정해 재시도한다. 이미 전달된 메시지를 다시 보내므로 2~3번 받는다(최대 시도 3회). 메일이 SMTP 중계로 더 느려 더 자주 걸린다.
- 근거: `src/retry/policy.js`의 `decide()`가 `outcome.ok`보다 `elapsedMs > timeoutMs`를 먼저 검사했다. `src/digest/deadline.js`의 `withDeadline()`은 `fn()`이 성공한 뒤에 시간만 보고 `SendTimeoutError`를 던졌고, 이때 runner는 `markSent` 전에 catch하므로 원장에 보낸 키가 없어 다시 보낸다. 수정 전 테스트 3개 실패, 수정 후 통과. 지연이 제한 이하이거나 실제 실패(transient)면 영향이 없다는 점이 조건과 맞는다.
- 사람 추정 판정: 없음
- 기각한 가설:
  - dedupe 키/저장소 결함 — 수신 중복은 `checkAndMark`가 막고, 재시도는 dedupe를 거치지 않으므로 이 증상과 무관. 같은 이벤트 id 재수신 테스트가 기존에 통과.
  - 재시도 워커 동시 실행 — `takeDue`가 job을 꺼내 제거하므로 같은 job이 두 번 실행되지 않음.

## 변경 요약
- src/retry/policy.js — 성공(`outcome.ok`)이면 걸린 시간과 무관하게 `done`. 제한 시간 초과는 실패한 경우에만 `timeout` 사유로 재시도.
- src/digest/deadline.js — 성공한 발송을 시간 초과 오류로 바꾸지 않고 걸린 시간만 돌려준다. 사용하지 않게 된 import 제거.
- test/slow-success.test.js — 새 테스트(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/slow-success.test.js
- 수정 전: 실패 — `node --test test/slow-success.test.js` → 4개 중 3개 실패(decide, 느린 메일, 느린 요약), 실패 재시도 테스트는 통과
- 수정 후: 통과 — 같은 명령, 4개 모두 통과

## 테스트 실행
- 명령: `npm test`
- 결과: 78개 통과, 0 실패 (기존 74 + 신규 4)
- 실패 항목: 없음

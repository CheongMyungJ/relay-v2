## 재현
- 재현 절차: `test/no-double-send.test.js`를 수정 전 `src/`에서 실행(`npm test`). 예: 가짜 메일 전송에 `outcomes: [{ latencyMs: 3000 }]`(3초 걸려 성공)을 주고 `notifier.handle(shippedEvent())` 뒤 시계를 120초 미루고 `retryWorker.runDue()`.
- 결과: 재현됨
- 기대: 메일 1통(`mail.sent.length === 1`), 재시도 없음
- 실제: 첫 발송이 성공했는데도 `retry-scheduled`가 되어 재시도에서 한 번 더 발송됨(2통). 요약 메일도 같은 경로로 중복.

## 원인
- 원인: 발송이 성공해도 걸린 시간이 제한(`send.timeoutMs` 2000ms, 요약은 `sendTimeoutMs` 3000ms)을 넘으면 시간 초과 실패로 판정해 재시도했다. 이미 전달된 알림을 다시 보내 중복된다. 또 요약 발송 기록 키에 `runId`가 들어 있어, 같은 기간을 다시 돌리면(runId가 달라서) 이미 보낸 요약도 또 보낸다.
- 근거: `src/retry/policy.js`의 `decide`가 `elapsedMs > timeoutMs`를 `outcome.ok`보다 먼저 검사함. `src/digest/deadline.js`의 `withDeadline`은 성공한 뒤에도 느리면 `SendTimeoutError`를 던짐(그러면 `ledger.markSent`가 안 불리고 재시도). `src/digest/key.js`는 `runId`를 키에 포함. 실험: 위 수정만 되돌리면(`src` 변경 stash) 새 테스트 5개가 실패, 적용하면 모두 통과. 메일이 더 잦은 이유: 메일 기본 지연 400ms로 SMTP 중계가 느려지면 2초를 넘기기 쉬움(푸시 80ms). 푸시도 같은 코드라 느리면 중복(테스트로 확인).
- 사람 추정 판정: 없음
- 기각한 가설: 중복 제거(dedupe) 키 문제 — 수신 단계는 같은 이벤트를 막고 있었고 재현은 재시도 경로에서 일어남. 재시도 워커가 같은 job을 두 번 꺼냄 — `takeDue`가 shift로 꺼내므로 아님.

## 변경 요약
- src/retry/policy.js — 성공(`outcome.ok`)이면 느려도 `done`. 실제 실패일 때만 timeout/transient 판정.
- src/digest/deadline.js — 느리게 성공해도 오류로 바꾸지 않고 결과와 `elapsedMs`를 돌려줌.
- src/digest/key.js, src/digest/runner.js — 발송 기록 키에서 `runId` 제거(기간+사용자). 실행별 건수는 entries의 `runId`로 세므로 영향 없음.
- (기존 테스트 변경) 없음

## 재현 테스트
- 위치: test/no-double-send.test.js (8개: 느린 성공 메일/푸시/요약, 요약 재실행, 실제 실패 재시도 3종 포함)
- 수정 전: 실패 (`npm test`: 5개 실패 — 44, 45, 46, 49, 50번)
- 수정 후: 통과 (`npm test`: 82 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 82개 통과, 0 실패 (기준 커밋은 74개 통과)
- 실패 항목: 없음

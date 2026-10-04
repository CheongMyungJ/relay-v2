## 재현
- 재현 절차: `npm test` 중 새로 추가한 테스트 3건(아래). 수정 전 코드에서 실행. 예: 메일 transport를 `outcomes: [{ latencyMs: 2500 }]`(성공하지만 2.5초 걸림)로 두고 `notifier.handle(shippedEvent())` 뒤 재시도 워커를 돌린다.
- 결과: 재현됨
- 기대: 메일 transport 호출 1회, 대기열 비어 있음
- 실제: 발송은 성공했는데 `retry-scheduled`로 기록되고 재시도에서 한 번 더 발송되어 같은 메일이 두 번 감 (요약 메일도 같은 방식)

## 원인
- 원인: 성공 여부보다 걸린 시간을 먼저 봐서, 발송이 성공했어도 `send.timeoutMs`(2초; 요약은 3초)를 넘기면 시간 초과 실패로 처리해 다시 보냈다. 이미 도착한 알림이 재시도로 또 가며, 응답이 느린 메일에서 더 자주 생긴다. 재시도마다 반복되면 3통까지 간다(maxAttempts 3).
- 근거: `src/retry/policy.js`의 `decide`가 `elapsedMs > timeoutMs`를 `outcome.ok`보다 먼저 검사(수정 전 11~19줄). `src/digest/deadline.js`의 `withDeadline`은 `fn()`이 성공한 뒤에 시간 초과 오류를 던져, 요약은 보낸 기록(`ledger.markSent`)도 남기지 않고 재시도 → 중복. 수정 전 새 테스트 3건 실패, 수정 후 통과. 푸시는 지연이 짧아 덜 걸리고 메일은 지연이 커서 더 잦음(`fake-transports.js`의 기본 지연 400ms/80ms는 같은 구조).
- 사람 추정 판정: 없음
- 기각한 가설: 중복 제거(dedupe) 키 문제 — 키는 `traceId`/`data` 등을 제외하고 안정적이며 동시 수신 시험이 통과함. 재시도 큐 중복 등록 — 한 번 꺼낸 일만 다시 넣는 구조라 해당 없음. 요약 키에 runId가 들어가는 점(`src/digest/key.js`) — 일정이 기간당 한 번만 실행(`scheduler.js`의 lastPeriod)해서 이 변경의 원인은 아님(다만 프로세스 재시작·수동 재실행 시 중복 가능성은 남음).

## 변경 요약
- src/retry/policy.js — 성공이면 소요 시간과 무관하게 `done`. 실패일 때만 시간 초과 사유로 구분(재시도 횟수·백오프 동작은 그대로).
- src/digest/deadline.js — 성공한 발송을 시간 초과 오류로 바꾸지 않고 `slow` 플래그만 돌려줌.
- src/digest/runner.js — `slow`면 경고 로그만 남기고 정상적으로 보낸 기록을 남김.
- (같은 원인이 두 경로에 있어 요약 메일도 함께 고쳤다. 의도의 "메일" 범위에 속한다.)

## 재현 테스트
- 위치: test/retry.test.js(느린 성공은 done), test/notifier.test.js(느린 메일 재발송 안 함), test/digest.test.js(느린 요약 재발송 안 함). 실제 실패는 재시도되는지 확인하는 테스트도 같이 추가(시간 초과 실패 → 재발송, 요약 포함)
- 수정 전: 실패 — `npm test`에서 `not ok` 3건(느린 요약 / 느린 메일 / decide 느린 성공)
- 수정 후: 통과 — `npm test` pass 80 fail 0

## 테스트 실행
- 명령: npm test
- 결과: 80건 통과, 0건 실패 (기존 74건 변경 없음)
- 실패 항목: 없음

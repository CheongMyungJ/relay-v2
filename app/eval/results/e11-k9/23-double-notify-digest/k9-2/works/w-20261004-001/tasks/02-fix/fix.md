## 재현
- 재현 절차: `node --test test/duplicate-send.test.js` (가짜 전송의 `latencyMs`를 제한 시간보다 길게 줘서 성공하지만 느린 발송을 흉내 냄. 메일 3000ms > `send.timeoutMs` 2000ms, 푸시 2500ms, 요약 메일 4000ms > `digest.sendTimeoutMs` 3000ms)
- 결과: 재현됨
- 기대: 성공한 발송은 한 번만 일어난다 (`mail.calls.length === 1`, 재시도 대기열 비어 있음)
- 실제: 발송은 성공했는데 `retry-scheduled`로 처리되어 재시도 때 같은 알림이 한 번 더 나감 (최대 3회 → "가끔 세 번")

## 원인
- 원인: 발송이 성공해도 걸린 시간이 제한 시간을 넘으면 실패(timeout)로 보고 재시도한다. 이미 나간 알림이 다시 나가 중복된다. 즉시 발송(`decide`)과 요약 발송(`withDeadline`) 두 곳에 같은 결함이 있다.
- 근거: `src/retry/policy.js`의 `decide`가 `elapsedMs > timeoutMs`를 `outcome.ok`보다 먼저 검사했다. `src/digest/deadline.js`의 `withDeadline`은 `fn()`이 성공한 뒤에도 시간이 넘으면 `SendTimeoutError`를 던졌고 runner가 transient로 보고 재시도했다. 메일 기본 지연이 400ms로 푸시(80ms)보다 길고 SMTP가 느려지기 쉬워 메일에서 더 자주 나타나는 것과 맞는다. 실험: 수정 전 새 테스트 3개 실패, 수정 후 통과. 지연이 제한 시간 이내이거나 실제 실패인 경우는 영향이 없다(재현 안 됨 조건과 일치).
- 사람 추정 판정: 없음
- 기각한 가설: dedupe(`src/dedupe`) 결함 — 키는 traceId 등을 빼고 안정적이고, 같은 이벤트 동시 수신 테스트가 이미 통과하며, 재시도는 dedupe를 거치지 않으므로 재시도 중복을 설명하지 못함. 요약 ledger 키에 runId가 들어가는 점 — 별도 run 사이 중복 가능성은 있으나(`digest/key.js`) 이번 증상(성공 후 재시도)의 원인은 아니고 범위 밖이라 손대지 않음.

## 변경 요약
- src/retry/policy.js — 성공(`outcome.ok`)이면 시간과 무관하게 `done`. 실패일 때만 시간 초과 사유를 적용.
- src/digest/deadline.js — 성공한 발송을 시간 초과로 던지지 않음(경과 시간만 돌려줌). `timeoutMs` 인자는 호환을 위해 남겨 둠(현재 미사용).
- test/duplicate-send.test.js — 신규 재현 테스트 4개.

## 재현 테스트
- 위치: test/duplicate-send.test.js
- 수정 전: 실패 — `node --test test/duplicate-send.test.js` → pass 1 / fail 3 (정책, 메일·푸시 즉시 발송, 요약)
- 수정 후: 통과 — 같은 명령 → 4개 모두 통과 (메일·푸시 모두 한 번만 발송, 실제 실패(timeout/transient)는 재시도로 다시 발송됨도 확인)

## 테스트 실행
- 명령: `npm test`
- 결과: 78개 통과, 0 실패 (기존 74 + 신규 4)
- 실패 항목: 없음

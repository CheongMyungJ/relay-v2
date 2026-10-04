## 재현
- 재현 절차: 수정 전 코드에 새 테스트만 얹어 `npm test` 실행. 가짜 메일/푸시 transport가 3000ms 걸려 성공(`outcomes: [{ latencyMs: 3000 }]`)하게 하고 `notifier.handle(shippedEvent())` 호출(제한 시간 `send.timeoutMs`=2000). 요약은 `mail: { outcomes: [{ latencyMs: 4000 }] }`로 `notifier.digest.tick()` (제한 `digest.sendTimeoutMs`=3000).
- 결과: 재현됨
- 기대: 채널당 한 번만 전달, 재시도 대기열 비어 있음
- 실제: 전달은 성공했는데 `retry-scheduled`로 기록되고 대기열에 들어가 재시도 때 또 전달됨(최대 3회 = 두 번, 세 번). 요약도 같은 요약이 재전송됨.

## 원인
- 원인: 발송이 성공했는데 걸린 시간이 제한 시간을 넘으면 "시간 초과 실패"로 취급해 다시 보낸다. 이미 전달된 알림이 재시도로 중복된다.
- 근거: `src/retry/policy.js` `decide()`가 `elapsedMs > timeoutMs`를 `outcome.ok`보다 먼저 검사했다. 요약 경로의 `src/digest/deadline.js` `withDeadline()`은 `fn()`이 값을 돌려준 뒤에도 경과 시간으로 `SendTimeoutError`를 던져 runner가 재시도했고, `ledger.markSent`는 성공 때만 불려 중복 방지 기록도 남지 않았다. 메일은 기본 지연(400ms)이 푸시(80ms)보다 길고 SMTP 중계가 느려 제한을 넘기기 쉬워 더 자주 나타난다. 실험: 수정 전 새 테스트 3건 실패, 수정 후 통과. 느리지 않거나 실제 실패인 경우는 기존 동작 그대로라 재현되지 않는다.
- 사람 추정 판정: 없음 (요청에 원인 추정 없음)
- 기각한 가설: dedupe(`src/dedupe/`)는 수신 단계 중복만 거르며 재시도 경로(`deliver`)를 거치지 않아 이 증상과 무관 — 수정 없이 재현됨. 재시도 워커의 이중 실행은 `takeDue`가 꺼내며 제거하므로 아님.

## 변경 요약
- src/retry/policy.js — `outcome.ok`를 먼저 검사해 성공은 소요 시간과 무관하게 `done`. 실패 시의 시간 초과 재시도와 횟수·간격 정책은 그대로.
- src/digest/deadline.js — 값이 돌아온 뒤 시간 초과 오류를 던지지 않음. 소요 시간은 `digest.send.ms` 지표로만 남음. 실제 시간 초과는 어댑터 오류(ETIMEDOUT)로 계속 재시도됨.

## 재현 테스트
- 위치: test/retry.test.js(느린 성공은 done), test/notifier.test.js(느린 메일·푸시 한 번만 전달 / 실제 실패 메일은 재시도로 재전송), test/digest.test.js(느린 요약 한 번만)
- 수정 전: 실패 — `npm test`에서 3건 실패(retry, notifier, digest 각 1건). 실패 재시도 테스트는 기존 동작이라 수정 전에도 통과.
- 수정 후: 통과 — `npm test` pass 78 / fail 0
- 기존 테스트는 변경하지 않음.

## 테스트 실행
- 명령: `npm test`
- 결과: 78 통과, 0 실패
- 실패 항목: 없음

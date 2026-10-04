## 재현
- 재현 절차: 가짜 메일 transport가 3000ms 걸려 성공하게 하고(`outcomes: [{ latencyMs: 3000 }]`, 제한 시간 `config.send.timeoutMs`=2000) 이벤트를 `notifier.handle`로 넣은 뒤 재시도 워커를 돌린다. 요약은 `digest.tick()`에 4000ms 걸리는 성공(`sendTimeoutMs`=3000)을 쓴다. 테스트로 옮겨 두었다: `npm test`
- 결과: 재현됨
- 기대: 메일은 한 번만 호출되고 재시도 대기열은 비어 있다. 요약도 한 통만 나간다.
- 실제: 메일이 이미 전달됐는데 `retry-scheduled`가 되어 한 번 더 발송된다(요약도 같다). 수정 전 새 테스트 2개 실패.

## 원인
- 원인: 발송 성공 여부보다 걸린 시간을 먼저 봐서, 제한 시간을 넘겨 "성공한" 발송을 시간 초과(일시적 오류)로 판정해 재시도한다. 이미 전달된 알림이 다시 나간다.
- 근거: `src/retry/policy.js`의 `decide`가 `elapsedMs > timeoutMs`를 `outcome.ok`보다 먼저 검사했다. 요약 경로는 `src/digest/deadline.js`의 `withDeadline`이 fn 성공 뒤에도 시간 초과 오류를 던져 runner가 재시도했고, 성공 기록(ledger)이 남지 않아 건너뛰지도 못했다. 수정 전 두 재현 테스트 실패, 수정 후 통과. 메일이 더 자주 겪는 이유: 메일 SMTP 지연이 푸시보다 길어 제한 시간을 넘기기 쉽다(가짜 transport 기본값 400ms vs 80ms). 빠르게 성공하면 재현되지 않는다. 세 번째 중복은 재시도 한 번 더가 느리게 성공할 때(maxAttempts=3) 생긴다.
- 사람 추정 판정: 없음
- 기각한 가설: dedupe(수신 중복 제거) 결함 — 이벤트 키는 안정적이고 중복은 발송 단계에서 생겼다. 재시도 워커/큐가 같은 job을 두 번 꺼냄 — `takeDue`가 꺼내며 제거하므로 아니다. 요약 키에 runId가 들어가 실행마다 달라지는 점은 같은 실행 안의 재시도에는 영향이 없고, scheduler가 기간당 한 번만 돌리므로 이번 원인이 아니다(재실행 시 중복 가능성은 risks).

## 변경 요약
- `src/retry/policy.js` — `outcome.ok`를 먼저 검사해 성공은 걸린 시간과 무관하게 `done`. 실패 판정(시간 초과 사유 포함)은 그대로라 실제 실패는 계속 재시도된다.
- `src/digest/deadline.js` — 성공한 fn은 느려도 값을 돌려주고 `slow` 플래그만 붙인다. 실패는 그대로 던진다.
- `test/notifier.test.js`, `test/digest.test.js` — 재현 테스트와 재시도 유지 테스트 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: `test/notifier.test.js`(느린 성공 한 번만 발송, 실제 실패는 재시도), `test/digest.test.js`(느린 요약 성공 한 번만)
- 수정 전: 실패 (`npm test` → 77개 중 새 테스트 2개 `not ok`, 재시도 유지 테스트는 통과)
- 수정 후: 통과 (`npm test` → pass 77, fail 0)

## 테스트 실행
- 명령: `npm test`
- 결과: tests 77, pass 77, fail 0
- 실패 항목: 없음

## 재현
- 재현 절차: `npm test` (새 테스트 추가 후, 수정 전 코드에서). 가상 시계에서 메일 transport 지연을 3000~5000ms로 두고 이벤트를 보낸다.
- 결과: 재현됨
- 기대: 메일이 한 번만 발송된다 (`mail.calls.length === 1`)
- 실제: 메일은 이미 나갔는데 결과가 `retry-scheduled`가 되어 재시도 때 한 번 더 나간다. 요약 메일은 `summary.sent`가 0이고 다시 보낸다.

## 원인
- 원인: 발송이 성공했어도 걸린 시간이 제한 시간(send 2000ms, digest 3000ms)을 넘으면 실패(timeout)로 판정해 재시도 대기열에 넣는다. 이미 상대에게 간 메일을 다시 보내 중복이 된다.
- 근거: `src/retry/policy.js`의 `decide`가 `outcome.ok`보다 `elapsedMs > timeoutMs`를 먼저 검사함. 요약 경로의 `src/digest/deadline.js` `withDeadline`도 성공 뒤 같은 방식으로 던져 `markSent`가 불리지 않고 재시도됨. 메일은 응답이 느려(기본 400ms, 지연 시 수 초) 푸시보다 자주 걸린다. 재시도 3회(maxAttempts) 때문에 "가끔 세 번"이 나온다. 수정 전 새 테스트 3개 실패, 수정 후 통과(실험으로 확인).
- 사람 추정 판정: 없음
- 기각한 가설: 중복 제거(dedupe) 키 문제 — 중복은 수신 중복이 아니라 발송 뒤 재시도에서 생김. 재현 테스트로 확인. / 요약 키에 runId가 들어간 것 — 같은 실행 안의 중복과 무관(별개 위험, risks에 기록)

## 변경 요약
- src/retry/policy.js — 성공(`outcome.ok`)이면 시간과 관계없이 `done`. 실패한 발송은 그대로 재시도.
- src/digest/deadline.js — 성공한 발송을 시간 초과 오류로 바꾸지 않음. 같은 원인의 요약 경로.
- test/retry.test.js, test/notifier.test.js, test/digest.test.js — 테스트 추가(기존 테스트 변경 없음).

## 재현 테스트
- 위치: test/notifier.test.js `메일이 느리게 성공해도 한 번만 보낸다`, test/digest.test.js `요약 메일이 느리게 성공해도 한 번만 보낸다`, test/retry.test.js `제한 시간보다 늦게 끝나도 ...`. 실제 실패 재시도: test/notifier.test.js `메일 발송이 실제로 실패하면 재시도로 다시 보낸다`
- 수정 전: 실패 (`npm test` → 3개 실패, 예: expected 'sent', actual 'retry-scheduled')
- 수정 후: 통과 (`npm test` → 79 pass, 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 79 통과, 0 실패
- 실패 항목: 없음

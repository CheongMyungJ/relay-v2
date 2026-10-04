## 재현
- 재현 절차: `test/notifier.test.js`의 새 테스트를 수정 전 코드로 실행 — `npm test` (메일 가짜 transport 지연 3000ms, 제한 시간 `config.send.timeoutMs`=2000ms)
- 결과: 재현됨
- 기대: 메일이 한 번 성공하면 `status: 'sent'`, 재시도 대기열에 안 들어가고 메일은 1통
- 실제: 발송은 성공했는데 `retry-scheduled`로 기록되고, 재시도 워커가 한 번 더 보내 같은 메일이 두 통 나간다

## 원인
- 원인: `decide()`가 결과(성공 여부)보다 먼저 `elapsedMs > timeoutMs`를 검사해, 이미 성공한 발송도 `timeout`으로 보고 재시도시킨다. 요약 메일의 `withDeadline()`도 성공 뒤에 시간만 넘으면 예외를 던져 ledger에 안 남기고 다시 보낸다.
- 근거: `src/retry/policy.js`의 timeout 분기가 `outcome.ok` 분기보다 앞이었다. 메일은 지연이 길어(기본 400ms, 느린 중계 서버 3000ms+) 제한 시간을 넘기기 쉬워 메일에서 더 잦다. 푸시(80ms)는 드물게 같은 경로를 탄다. 수정 전 새 테스트 2건 실패, 수정 후 통과(실험으로 확인). 빠른 성공이나 실패한 발송은 영향이 없어 "일부 고객·가끔"과 맞는다.
- 사람 추정 판정: 없음 (요청에 원인 추정 없음)
- 기각한 가설: dedupe 저장소(TTL/키)·재시도 대기열의 중복 enqueue — 읽어 보니 재시도는 `finish()`가 `retry`일 때만 1건 넣고, 중복의 직접 원인은 성공을 retry로 판정하는 것이었다. 별도 실험은 안 함.

## 변경 요약
- src/retry/policy.js — 성공(`outcome.ok`)이면 소요 시간과 상관없이 `done`. 실패일 때의 timeout 판정은 그대로.
- src/digest/deadline.js — 느려도 성공이면 예외를 던지지 않고 `slow` 표시만 돌려줌. 실패 오류는 그대로 전달.
- test/notifier.test.js, test/digest.test.js — 새 테스트만 추가 (기존 테스트 변경 없음)

## 재현 테스트
- 위치: test/notifier.test.js "메일이 제한 시간보다 오래 걸려도 성공했으면 다시 보내지 않는다", test/digest.test.js "요약 메일이 제한 시간보다 오래 걸려도 …", 실제 실패 재시도 확인은 test/notifier.test.js "발송이 실제로 실패하면 다시 보낸다"
- 수정 전: 실패 (`src`만 되돌리고 `npm test` → 75 pass / 2 fail, 위 두 테스트)
- 수정 후: 통과 (`npm test` → 77 pass / 0 fail)

## 테스트 실행
- 명령: `npm test`
- 결과: 77 pass, 0 fail
- 실패 항목: 없음

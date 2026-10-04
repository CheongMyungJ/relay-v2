# 성공했지만 느린 발송을 시간 초과로 재시도해 중복 발송되던 문제 수정

## 요약
발송이 성공했는데 제한 시간(발송 2초, 요약 3초)을 넘겼다는 이유로 재시도해 같은 알림이 2~3번 가던 문제를 고쳤다. 메일은 SMTP 중계로 느려 더 자주 걸렸다. 재시도 기능과 실제 실패의 재시도는 그대로다.

## 원인
`decide()`가 `outcome.ok`보다 `elapsedMs > timeoutMs`를 먼저 검사했고, `withDeadline()`은 성공한 뒤에도 시간만 보고 `SendTimeoutError`를 던졌다. 이미 전달된 메시지를 다시 보냈다.

## 변경
- src/retry/policy.js: 성공이면 걸린 시간과 무관하게 `done`. 시간 초과는 실패한 경우에만 재시도 사유.
- src/digest/deadline.js: 성공한 발송을 오류로 바꾸지 않고 걸린 시간만 돌려준다. 쓰지 않는 `timeoutMs` 인자 제거(runner 호출부 수정).
- docs/knowledge/retry/: 재시도를 끄지 않는다는 규칙과 느린 성공 함정을 기록.

## 테스트
- 새 test/slow-success.test.js(메일, 푸시, 요약, decide, 실제 실패 재시도): 수정 전 4개 실패, 수정 후 통과.
- `npm test`: 79개 통과.
- 남은 위험: 소켓 시간 초과 뒤 실제로 전달된 경우의 중복, `digest.sendTimeoutMs` 설정이 쓰이지 않음.

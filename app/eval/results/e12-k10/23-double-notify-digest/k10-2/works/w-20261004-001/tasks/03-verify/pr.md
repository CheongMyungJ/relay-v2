# fix: 성공한 발송을 제한 시간 초과로 보고 다시 보내는 중복 발송 수정

## 요약
발송이 성공했는데 제한 시간을 넘겼다는 이유로 재시도되어 같은 알림(메일, 드물게 푸시)과 요약 메일이 두 번 나가던 문제를 고쳤다.

## 원인
`decide()`가 성공 여부보다 먼저 `elapsedMs > timeoutMs`를 검사해 성공한 발송도 timeout 재시도로 보냈다. 요약 메일의 `withDeadline()`도 성공 뒤 시간만 넘으면 예외를 던져 다시 보냈다. 메일은 지연이 길어 더 자주 걸렸다.

## 변경
- `src/retry/policy.js`: 성공이면 소요 시간과 상관없이 `done`. 실패 시 재시도 정책은 그대로.
- `src/digest/deadline.js`: 느려도 성공이면 예외 대신 `slow` 표시만 반환.
- `docs/knowledge/dispatch/retry-only-failed-sends.md`: 규칙 기록.

## 테스트
- `npm test`: 78 pass, 0 fail
- 새 테스트: 메일·푸시·요약 메일의 느린 성공은 재발송하지 않음, 실제 실패는 재시도됨
- 수정 전 코드에서는 새 중복 재현 테스트가 실패함을 확인

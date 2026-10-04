# 느리게 성공한 발송을 시간 초과로 보고 다시 보내던 중복 발송 수정

## 요약
성공한 발송이 제한 시간을 넘겼다는 이유로 실패 처리되어 같은 알림이 두세 번 가던 문제를 고친다. 응답이 느린 메일 채널에서 더 자주 나타났다.

## 원인
`src/retry/policy.js`의 `decide`가 `outcome.ok`보다 시간 초과를 먼저 검사했고, `src/digest/deadline.js`의 `withDeadline`은 성공 뒤에도 시간 초과 오류를 던졌다. 둘 다 이미 전달된 알림을 재시도로 다시 보냈다.

## 변경
- `decide`: 성공이면 걸린 시간과 상관없이 `done`. 실패 시 재시도 정책은 그대로.
- `withDeadline`: 성공을 뒤집지 않고 걸린 시간만 잰다.
- `docs/knowledge/retry/slow-success-is-not-timeout.md` 추가.

## 테스트
- `test/duplicate-send.test.js` 5건 추가(느린 성공은 1회 발송, 실제 실패는 재시도, 요약 경로 포함)
- `npm test` 79건 통과

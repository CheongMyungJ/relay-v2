# fix: 응답이 늦은 성공 발송을 시간 초과로 재시도해 중복 발송하던 문제 수정

## 요약
전달에 성공했지만 응답이 제한 시간(발송 2초, 요약 3초)을 넘은 발송을 시간 초과로 보고 다시 보내 같은 알림이 두세 번 나가던 문제를 고쳤다. 메일·푸시·요약 메일 모두 해당한다.

## 원인
`decide()`가 `outcome.ok`보다 걸린 시간을 먼저 검사해 성공도 `retry`로 돌렸고, `withDeadline()`은 성공한 뒤에도 시간이 넘으면 예외를 던져 요약을 다시 보냈다.

## 변경
- `src/retry/policy.js`: 성공이면 소요 시간과 무관하게 `done`. 실패한 발송의 재시도 정책은 그대로.
- `src/digest/deadline.js`: 예외 대신 `slow` 플래그를 돌려준다.
- `src/digest/runner.js`: `slow`이면 `digest.send.slow` 지표를 올린다.
- `docs/knowledge/slow-success-is-success.md`: 팀 지식 추가.

## 테스트
- `test/duplicate-send.test.js` 6건 추가: 느린 성공 3건(수정 전 실패), 실제 실패는 재시도되는 3건.
- `npm test`: 80건 모두 통과. 기존 테스트 변경 없음.

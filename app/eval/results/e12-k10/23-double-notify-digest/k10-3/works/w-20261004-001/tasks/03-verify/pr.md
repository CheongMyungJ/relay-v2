# 느리게 성공한 발송을 시간 초과로 보고 다시 보내던 중복 발송 수정

## 요약
발송이 성공했지만 제한 시간을 넘기면 실패(timeout)로 보고 재시도해 같은 알림이 최대 3통 가던 문제를 고쳤다. 일반 발송과 요약 발송 모두 해당한다. 재시도는 그대로 둔다.

## 원인
`src/retry/policy.js`의 `decide`가 `elapsedMs > timeoutMs`를 `outcome.ok`보다 먼저 검사했고, `src/digest/deadline.js`의 `withDeadline`도 성공 후 시간이 넘으면 오류를 던져 `markSent` 없이 재발송했다. 지연이 큰 메일 채널에서 더 자주 나타났다.

## 변경
- `policy.js`: 성공이면 걸린 시간과 관계없이 `done`. 실패 발송의 timeout 재시도는 유지
- `deadline.js`: 성공 후 초과를 오류 대신 `overrun`으로 알림
- `runner.js`: 느린 성공도 `markSent`로 기록하고 `digest.slow` 지표와 경고 로그를 남김
- `docs/knowledge/dispatch/`: 재시도를 끄지 않는다는 규칙과 성공 우선 판정 지식 추가

## 테스트
- `npm test` 78개 통과
- 회귀 테스트 2개(메일, 요약)는 수정 전 코드에서 실패하는 것을 확인
- 실제 실패한 발송이 재시도로 다시 발송되는 테스트 2개 추가

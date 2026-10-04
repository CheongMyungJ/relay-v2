# 느리게 성공한 발송과 다시 온 이벤트로 알림이 중복 발송되는 문제 수정

## 요약
같은 알림이 고객에게 두 번 이상 가던 문제를 고쳤다. 재시도는 그대로 두고, 실제로 실패한 발송은 지금처럼 다시 보낸다.

## 원인
- 즉시 발송 재시도 판단(`src/retry/policy.js`)과 요약 제한 시간(`src/digest/deadline.js`)이 성공 여부보다 걸린 시간을 먼저 봐서, 늦게 끝난 성공을 실패(timeout)로 보고 재시도했다.
- 중복 제거 키에 수신 시각(`receivedAt`), 요약 키에 `runId`가 들어 있어 다시 온 이벤트와 재실행을 알아보지 못했다.

## 변경
- `src/retry/policy.js`: 성공이면 걸린 시간과 상관없이 `done`.
- `src/digest/deadline.js`, `src/digest/runner.js`: 늦은 성공은 오류가 아니라 `slow`로 알리고 경고 로그만 남긴다.
- `src/dedupe/key.js`: `receivedAt`을 키에서 제외.
- `src/digest/key.js`: `runId`를 키에서 제외(`digest:기간:사용자`). 실행별 집계는 ledger의 `runId` 필드로 한다.
- `docs/knowledge/delivery/`: 재시도 관련 규칙과 함정을 기록.

## 테스트
- `test/no-double-send.test.js` 추가: 메일·푸시·요약의 느린 성공, 요약 재실행, 늦게 다시 온 이벤트는 한 번만 발송하고, 실제 실패는 재발송한다. 수정 전 5개 실패.
- `npm test`: 82개 중 82개 통과. 기존 테스트는 바꾸지 않았다.

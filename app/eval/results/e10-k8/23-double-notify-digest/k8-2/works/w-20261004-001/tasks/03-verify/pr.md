# 느리게 성공한 발송을 실패로 보고 다시 보내던 중복 발송 수정

## 요약
일부 고객이 같은 알림을 두 번 받던 문제를 고쳤다. 재시도는 그대로 두고, 실제 실패만 재시도한다.

## 원인
- 발송이 성공해도 걸린 시간이 제한(`send.timeoutMs`)을 넘으면 시간 초과로 판정해 재시도해서 이미 전달된 알림이 또 나갔다. SMTP가 느려지기 쉬운 메일에서 더 잦았다.
- 요약 발송 기록 키에 `runId`가 들어 있어 같은 기간을 재실행하면 이미 보낸 요약도 다시 나갔다.

## 변경
- `src/retry/policy.js`: 성공이면 걸린 시간과 무관하게 `done`.
- `src/digest/timing.js`(구 `deadline.js`): 느려도 성공한 결과를 오류로 바꾸지 않음. 시간만 잼.
- `src/digest/key.js`, `runner.js`: 기록 키에서 `runId` 제거.
- `docs/knowledge/notify/`: 팀 지식 2건.

## 테스트
- `npm test`: 84개 통과. 새 `test/no-double-send.test.js`(10개)는 수정 전 `src/`에서 6개 실패.
- 실제 실패(transient, timeout)는 재시도되어 전달됨을 확인.

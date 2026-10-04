# 느리게 성공한 발송을 시간 초과로 보고 다시 보내 중복 발송되던 문제 수정

## 요약
제한 시간을 넘겨 성공한 발송(특히 메일)이 시간 초과로 판정돼 재시도되면서 같은 알림이 두 번 이상 나가던 문제를 고쳤다. 실제 실패의 재시도는 그대로다.

## 원인
`src/retry/policy.js`의 `decide`가 성공 여부보다 걸린 시간을 먼저 봤고, 요약 경로의 `withDeadline`도 성공 뒤 시간 초과 오류를 던져 재시도했다. 이미 전달된 알림이 다시 나갔다.

## 변경
- `src/retry/policy.js`: `outcome.ok`를 먼저 판정해 성공은 `done`.
- `src/digest/deadline.js`: 성공은 느려도 값을 돌려주고 `slow` 플래그만 붙임.
- `docs/knowledge/delivery/success-before-timeout.md`: 재발 방지용 지식.

## 테스트
- `npm test`: 77개 통과.
- 추가: 느린 성공 한 번만 발송(알림·요약), 실제 실패는 재시도되어 재발송. 수정 전 중복 재현 테스트 2개 실패 확인.

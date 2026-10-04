# fix: 제한 시간을 넘겨 성공한 발송을 재시도해 중복 전달되던 문제 수정

## 요약
일부 고객이 같은 알림을 두 번, 가끔 세 번 받던 문제를 고친다. 메일에서 더 자주 나타났다.

## 원인
발송이 성공했는데 걸린 시간이 제한 시간을 넘으면 "시간 초과 실패"로 보고 다시 보냈다. 일반 발송(`src/retry/policy.js`의 `decide`)은 `elapsedMs > timeoutMs`를 `outcome.ok`보다 먼저 검사했고, 요약 발송(`src/digest/deadline.js`의 `withDeadline`)은 값을 받은 뒤에도 경과 시간으로 오류를 던졌다. 메일은 지연이 푸시보다 길어 제한을 넘기기 쉽다.

## 변경
- `src/retry/policy.js`: 성공(`outcome.ok`)을 먼저 판정해 소요 시간과 무관하게 완료로 처리한다. 실패 시 시간 초과 재시도와 횟수·간격 정책은 그대로다.
- `src/digest/deadline.js`: 값이 돌아온 뒤 시간 초과 오류를 던지지 않는다. 소요 시간은 `digest.send.ms` 지표로만 남긴다.
- `docs/knowledge/delivery/`: 늦은 성공 규칙과 요약 제한 시간 설정 현황을 기록했다.

## 테스트
- `npm test`: 78 통과, 0 실패
- 추가: 느린 성공은 재시도하지 않음(retry), 느린 메일·푸시 한 번만 전달(notifier), 느린 요약 한 번만 전달(digest), 실제 실패한 메일은 재시도로 재전송(notifier)
- 수정 전 코드에서 새 테스트 3건이 실패함을 확인했고, 기존 테스트는 바꾸지 않았다.
- 남은 위험: `digest.sendTimeoutMs`가 효과 없는 설정이 됨, `src/digest/key.js`의 runId 키로 재실행 시 요약 중복 가능

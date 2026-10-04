# 요약 메일 중복 발송 수정: 느린 성공·응답 timeout을 실패로 보지 않고, 요약 키에서 runId 제거

## 요약
아침 요약 메일이 같은 날 두 통, 가끔 세 통 가던 문제를 고쳤다. 일시적 오류 같은 실제 실패는 그대로 재시도해 다시 보낸다.

## 원인
1. `withDeadline`이 발송에 성공했어도 3초를 넘기면 `SendTimeoutError`를 던져, 이미 간 요약을 실패로 보고 다시 보냈다(최대 3통).
2. `digestKey`에 실행마다 달라지는 `runId`가 들어가, 같은 기간을 재실행하면 이미 보낸 요약을 알아보지 못했다.
3. 메일 어댑터의 응답 시간 초과도 실패로 보고 재발송했다. 메일 서버는 응답이 늦어도 받은 메일은 내보내므로 이것도 중복이었다.

## 변경
- `src/digest/deadline.js`: 제한 시간을 넘겨도 던지지 않고 `slow`만 돌려준다.
- `src/digest/key.js`, `runner.js`: 키에서 runId 제거(실행별 집계는 ledger의 `runId`). 느린 성공은 `digest.slow` 지표와 경고 로그로 남김.
- `src/digest/runner.js`: 응답 시간 초과는 보낸 것으로 보고 ledger에 `unconfirmed: true`로 남기며 재발송하지 않음(`digest.unconfirmed` 지표).
- `src/adapters/mail.js`: 연결이 끊긴 ECONNRESET은 받았다고 볼 수 없어 timeout에서 빼고 재시도 대상 실패로 둠.
- `src/adapters/fake-transports.js`: 메일 `fail: 'timeout'`은 메일을 내보내고 오류를 던짐.
- `docs/knowledge/delivery/success-beats-timeout.md`: 메일 응답 timeout 처리 사실 추가.

## 테스트
- `npm test`: 80개 통과. 기준 커밋의 요약 코드로 되돌리면 새 테스트 3개가 실패하고, runner·mail.js 변경을 각각 되돌리면 해당 경로 테스트가 실패함을 확인.
- 경로별: 일시적 오류 → 재시도해 1통 / ECONNRESET → 재시도해 1통 / timeout → 재발송 없이 1통 / 영구 오류 → 재발송 없음(기존) / 재실행 → 다시 안 보냄.
- 남은 위험: timeout을 보낸 것으로 보는 근거는 메일 서버 담당자 확인, 푸시·일반 알림 경로는 이번 범위 밖, ledger 보관(3일) 이후 재실행.

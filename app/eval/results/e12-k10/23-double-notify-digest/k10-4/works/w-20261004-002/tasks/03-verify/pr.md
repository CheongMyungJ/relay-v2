# fix: 요약 메일 중복 발송과 누락 방지

## 요약
아침 요약 메일이 같은 날 두세 통 가던 문제를 고치고, 못 보낸 요약과 놓친 날의 요약이 다시 나가게 했다.

## 원인
- `withDeadline`이 발송에 성공한 뒤 걸린 시간이 제한 시간을 넘으면 시간 초과 오류를 던져, 이미 전달된 요약을 `maxAttempts`까지 다시 보냈다.
- `digestKey`에 `runId`가 들어가 재실행·재시작 때 이미 보낸 요약을 못 알아봤다.
- 스케줄러가 `run()` 전에 `lastPeriod`를 정해, 실패하거나 예외가 난 날은 다시 안 돌고 tick이 없던 날은 건너뛰었다.

## 변경
- `deadline.js`: 성공은 느려도 성공으로 보고 걸린 시간만 잰다.
- `key.js`, `runner.js`: 키를 기간+사용자로 하고, 일시 오류로 포기한 수(`retryable`)를 요약에 넣는다.
- `scheduler.js`, `inbox.js`: 남은 기간을 다음 tick에 `maxAttempts`회까지 다시 돌고(예외 포함), 놓친 날은 `keepDays` 안에서 보충한다. 겹친 tick을 막고 한 기간의 예외가 뒤 기간을 막지 않게 한다.
- `claims.js`: 발송 전 원자적 선점(`claim`), 성공 시 확정, 실패 시 해제. 서버 여러 대·재시작 뒤 중복은 공유 저장소를 `createNotifier({ digestClaims })`로 넣어야 막힌다(기본은 메모리).
- `docs/knowledge/digest/`에 키 규칙과 스케줄러 함정을 남겼다.

## 테스트
- `npm test`: 85개 통과 (기존 74 + 신규 11: `test/digest-duplicate.test.js` 6, `test/digest-claims.test.js` 5)
- 신규 테스트 6개는 수정 전 코드에서 모두 실패, 수정 후 통과

## 배포 시 주의
운영에서는 `digestClaims`에 서버들이 같이 쓰는 저장소 구현을 넣어야 서버 두 대·배포 날 중복이 막힌다.

# fix: 요약 메일 같은 날 중복 발송 원인 수정

## 요약
아침 요약 메일이 같은 날 두세 통 가던 문제를 원인부터 고쳤다. 실패한 요약은 다시 나가고 하루 누락도 없다.

## 원인
- `withDeadline`이 느리게 성공한 발송도 시간 초과로 던져, 이미 나간 메일을 runner가 재시도했다.
- 발송 키에 runId가 들어 있어 재시작·수동 재실행 때 발송 기록이 중복을 막지 못했다.
- scheduler가 실행 전에 `lastPeriod`를 기록해, 도중 오류가 나면 그 날 요약이 빠졌다.

## 변경
- `key.js`: 키를 `digest:{period}:{userId}`로 변경.
- `deadline.js`: 성공하면 던지지 않고 `slow`만 돌려주고, runner는 `digest.send.slow` 지표로 기록.
- `runner.js`: 같은 기간의 겹치는 실행을 하나로 합침.
- `scheduler.js`: 실행이 끝나고 실패가 없을 때만 `lastPeriod` 기록(실패가 있으면 다음 tick에서 재시도).
- `docs/knowledge/digest/digest-send-once-per-day.md` 추가.

## 테스트
- `npm test`: 83 통과, 0 실패.
- 경로별(예약, 재실행, 재실행+느린 성공, 동시 실행, 재시도) 한 통 확인, 실패 후 재발송, 도중 오류 뒤 누락 없음, 이틀 연속 테스트 추가. 기존 테스트는 변경 없음.

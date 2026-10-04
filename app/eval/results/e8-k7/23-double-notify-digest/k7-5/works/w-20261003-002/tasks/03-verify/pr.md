# fix: 요약 메일 중복·누락 수정

## 요약
아침 요약 메일이 같은 날 여러 통 가던 문제와, 실패·재시작으로 하루가 건너뛰어지던 문제를 고친다.

## 원인
- 요약 키에 runId가 들어가 재시작·재실행마다 키가 달라 이미 보낸 요약을 또 보냄
- `withDeadline`이 성공한 발송도 느리면 `SendTimeoutError`로 바꿔 재시도 → 같은 메일이 또 나감
- 스케줄러가 run 전에 `lastPeriod`를 기록하고 어제만 봐서, run이 터지거나 서버가 꺼진 날은 영영 건너뜀

## 변경
- `src/digest/key.js`: 키를 `digest:기간:사용자`로(runId 제거, 실행별 집계는 ledger entry의 runId)
- `src/digest/deadline.js`, `runner.js`: 느린 성공은 오류로 바꾸지 않고 `slow`로만 알림
- `src/digest/scheduler.js`: 실패 없이 끝난 기간만 done 기록, 포기 사용자가 있거나 터진 기간은 다음 tick에 재시도, inbox에 남은 놓친 기간 따라잡기, 진행 중 기간(inFlight)으로 tick 겹침 중복 방지
- `docs/knowledge/`: 스케줄러 규칙과 서버 두 대 사실 기록

## 테스트
- `npm test`: 82개 통과(요약 테스트 8개 추가, 기존 테스트 변경 없음). 기준 커밋 src에서는 추가 테스트 6개가 실패
- 알려진 한계: 서버 두 대 동시 경합은 공유 저장소 원자적 선점이 필요해 이번 범위 밖. 키 형식 변경 직후 배포 기간은 한 번 더 갈 수 있음

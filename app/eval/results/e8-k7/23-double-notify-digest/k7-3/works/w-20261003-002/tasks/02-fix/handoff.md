---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "느린 성공은 성공으로 처리하고 slow 지표·경고 로그만 남긴다"
    why: "팀 지식 docs/knowledge/slow-success-is-success.md 규칙. 실제 실패는 기존대로 재시도"
    by: ai
  - what: "요약 키에서 runId를 빼 기간+사용자로만 정한다"
    why: "재실행·재시작·수동 실행에서도 같은 날 요약이 한 번만 나가야 함. 실행별 집계는 기록의 runId로 유지"
    by: ai
assumptions:
  - "운영에서 발송 기록(ledger)은 서버들이 공유하는 DB라는 주석을 믿고, 메모리 구현으로 시험함"
rejected:
  - "scheduler.tick 동시 실행: lastPeriod를 await 전에 정해 겹치지 않음"
  - "재시도·발송 끄기: 비목표(증상만 가림)"
open_questions: []
intent_deviation: null
risks:
  - "src/retry/policy.js decide()도 같은 느린 성공 결함이 있어 보이나 일반 발송 경로라 범위 밖. 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기"
  - "요약 실행 중간에 프로세스가 죽거나 두 서버가 동시에 같은 기간을 돌리면(보내는 중인 키는 기록 전) 겹칠 수 있음. 동시 실행 잠금은 넣지 않음"
  - "정기 실행에서 포기한 요약은 다음 날 정기 실행이 다시 보내지 않고 수동 run()으로만 재발송됨. 이번에 바꾸지 않음"
recommended_next: null
knowledge_candidates:
  - "요약 메일 키는 기간+사용자로만 정한다. runId를 넣으면 재실행마다 중복 발송된다. 실행별 건수는 기록의 runId로 센다. 위치 src/digest/key.js"
---
## 요약
요약 중복 발송은 두 원인이었다. (1) 3000ms를 넘겨 성공한 발송을 시간 초과 오류로 던져 재시도, (2) 요약 키에 runId가 있어 재실행이 이전 발송을 못 알아봄. 두 곳을 고치고 시험 7개를 추가했다. 수정 전 5개 실패, 수정 후 전체 81개 통과.
## 다음 task가 알아야 할 것
- `src/digest/deadline.js`: 던지지 않고 `slow` 반환. `src/digest/runner.js`: `digest.send.slow` 지표.
- `src/digest/key.js`: 키 `digest:<기간>:<사용자>`.
- 시험: `test/digest.test.js` 끝 7개. 실행 `npm test`(81 통과).
- 위험: `src/retry/policy.js:15` 같은 결함은 건드리지 않음.

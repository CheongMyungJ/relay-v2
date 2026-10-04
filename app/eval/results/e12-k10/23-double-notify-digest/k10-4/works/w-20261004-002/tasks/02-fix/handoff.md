---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "키에서 runId를 빼고, 느린 성공을 성공으로 본다"
    why: "intent의 '한 통만'과 팀 지식 docs/knowledge/retry/slow-success-is-not-timeout.md의 규칙"
    by: ai
  - what: "스케줄러가 남은 기간을 다음 tick에서 재시도하고 놓친 날을 보충한다"
    why: "intent의 '미발송 재발송', '하루도 건너뛰지 않음'"
    by: ai
assumptions:
  - "ETIMEDOUT처럼 전달 여부를 모르는 어댑터 오류는 계속 재시도하며 드물게 중복될 수 있다(멱등 키 필요)"
rejected:
  - "retry/policy.js 원인설: 요약 경로는 retry/를 쓰지 않음"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 retry/ 쪽을 고쳤을 수 있음, 머지 대기"
  - "ledger는 메모리라 재시작하면 보낸 키가 사라져 중복 가능(운영 DB 공유 키는 이 코드 밖)"
  - "예외가 계속 나는 기간은 keepDays 안에서 매 tick 재시도됨"
recommended_next: null
knowledge_candidates:
  - "요약 발송 키(digestKey)에 runId를 넣으면 실행이 달라질 때 중복 발송된다. 키는 기간+사용자만 쓴다. 위치: src/digest/key.js"
  - "요약 스케줄러는 lastPeriod를 run 전에 정하면 실패한 날이 영영 안 나간다. 완료·남은 기간을 따로 관리한다. 위치: src/digest/scheduler.js"
---
## 요약
중복 원인 둘(느린 성공을 시간 초과로 뒤집음, 키에 runId 포함)과 누락 원인(실패·놓친 날 재시도 없음)을 고치고 재현 테스트 5개를 추가했다. `npm test` 79개 통과.
## 다음 task가 알아야 할 것
- 테스트: `npm test`, 신규 `test/digest-duplicate.test.js`
- 변경: `src/digest/{deadline,key,runner,scheduler,inbox}.js`
- `withDeadline`의 timeoutMs 인자는 이제 미사용(호출부 호환용)

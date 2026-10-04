---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "요약 키에서 runId를 뺐다"
    why: "재실행마다 키가 달라 중복 발송 (docs/knowledge/retry/digest-key-includes-run-id.md). 실행별 집계는 ledger 항목의 runId로 유지"
    by: ai
  - what: "withDeadline은 성공이면 시간과 무관하게 성공으로 돌려준다"
    why: "docs/knowledge/retry/success-is-never-resent.md 규칙"
    by: ai
assumptions:
  - "운영에서 발송 기록(ledger)은 공유 DB라 프로세스 재시작 뒤에도 키로 중복이 막힌다고 가정(여기선 메모리)"
rejected:
  - "재시도 횟수/기능 축소: 비목표이며 실제 실패는 재발송해야 함"
  - "스케줄러 lastPeriod 중복 실행: 한 프로세스에선 하루 한 번만 돎"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 src/retry/policy.js 등을 고쳤을 수 있음, 머지 대기. 발송 경로(policy.js decide)의 느린 성공 재시도는 이번 범위 밖이라 손대지 않음"
  - "ledger 메모리 구현은 재시작하면 비므로 재시작 직후 같은 기간 재실행은 운영 DB 기록에 의존"
recommended_next: null
knowledge_candidates:
  - "요약 키는 `digest:기간:사용자`로 runId를 넣지 않는다. 실행별 집계는 ledger entry의 runId로 한다"
  - "withDeadline은 성공을 시간 초과로 바꾸지 않는다(요약 경로 느린 성공 중복 방지)"
---
## 요약
요약 중복 원인 두 가지(느린 성공을 timeout으로 보고 재발송, 키의 runId로 재실행 중복)를 고치고 테스트 4건을 추가했다. `npm test` 78 통과.
## 다음 task가 알아야 할 것
- 수정: `src/digest/deadline.js`, `src/digest/key.js`, `src/digest/runner.js`
- 테스트: `test/digest.test.js` 끝 4건. 경로별 근거는 fix.md
- 발송 경로 `src/retry/policy.js`는 건드리지 않음

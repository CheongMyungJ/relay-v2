---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "재시도를 끄거나 줄이는 수정은 금지하고 제약에 넣는다"
    why: "팀 지식 keep-retry-for-real-failures 규칙과 요청의 '못 보낸 요약은 다시 보내야 한다'"
    by: ai
assumptions:
  - "요청이 곧 재현 절차이며, 재현은 fix 단계에서 만든다"
  - "일반 알림 경로는 비목표로 두되 같은 원인이면 예외로 한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 느린 성공을 시간 초과 실패로 보는 문제(src/retry/policy.js, src/digest/deadline.js)"
recommended_next: null
knowledge_candidates:
  - "요약 중복은 재시도를 끄거나 줄이는 것으로 해결하지 않으며, 실제 실패한 요약은 재시도로 다시 가야 하고 하루 건너뛰면 안 된다 (사람)"
---
## 요약
아침 요약 메일 중복 발송 버그의 intent 초안을 썼다. 모든 중복 경로에서 한 번만 발송, 실패 건은 재시도 유지, 경로별 근거 제시를 완료조건에 넣었다. 코드는 건드리지 않았다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`), 테스트는 `test/`에 있다.
- 요약 관련 코드: `src/digest/` (key, ledger, runner, scheduler, deadline), 재시도: `src/retry/`.
- 참고 팀 지식(조사 사실, 이번 원인의 근거는 아님): `docs/knowledge/retry/slow-success-is-not-failure.md`. 요약 키에 runId가 있어 재시작이나 재실행 시 중복 가능성이 적혀 있다.

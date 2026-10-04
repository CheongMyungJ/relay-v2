---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "요약 발송 코드는 src/digest/ 아래에 있다고 보고, 재현 절차는 fix에서 정한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 항목 두 개는 기준 브랜치(docs/knowledge/)에 아직 없다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
요약 메일 중복 발송 버그의 intent 초안을 썼다. 목표는 같은 날 요약 1회 발송이고, 미발송 건은 재발송하며 건너뛰지 않는다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`)
- 요약 코드: `src/digest/` (key.js, ledger.js, runner.js, deadline.js, scheduler.js)
- 참고용 팀 지식(조사 결과이며 이번 원인이라는 근거 아님, 기준 브랜치에는 아직 없음): `docs/knowledge/delivery/digest-key-includes-run-id.md`, `docs/knowledge/delivery/slow-success-is-not-timeout.md`

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "팀 지식의 부가세 규정(줄마다 버림)을 제약으로 옮기고 사람에게 다시 묻지 않음"
    why: "팀 지식 vat-per-line-floor.md는 반품 전표(creditTotals)에도 같은 규정이라고 적혀 있음"
    by: ai
assumptions:
  - "회계팀 계산은 팀 지식의 부가세 규정과 같다고 가정함 (회계팀의 CN-0112 기대 금액은 요청에 없음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "회계팀이 계산한 CN-0112의 정확한 환불 금액을 모름. fix에서 규정대로 계산한 값을 근거로 삼아야 함"
  - "팀 지식 두 항목은 앞 Work(w-20261004-001)에서 왔고 기준 브랜치에는 아직 없음. 같은 규칙을 어기는 코드가 청구서 쪽에 있으면 앞 Work에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 몇 원씩 다른 버그의 intent 초안을 썼다. 부가세 규정은 팀 지식을 제약으로 옮겼다.
## 다음 task가 알아야 할 것
- 관련 코드: `src/invoice/credit-note.js`의 `creditTotals`, 반품 요청/청구서는 `examples/CN-0112.json`, `examples/INV-2047.json`
- 테스트 명령: `npm test` (node --test)
- 참고할 팀 지식: docs/knowledge/invoice/vat-per-line-floor.md, docs/knowledge/invoice/issued-totals-and-format-frozen.md (기준 브랜치에는 아직 없음)
- 원인은 조사하지 않았음

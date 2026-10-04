---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1, 2(사소, 테스트 보강)를 모두 반영"
    why: "사람이 '모두 반영'을 골랐다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "발행된 청구서(예: INV-2047)의 저장 부가세와 새 규정의 반품 전표 부가세가 몇 원 어긋날 수 있다"
  - "공급가액이 음수인 줄은 없다고 보고 Math.floor를 씀"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 사소 2건(테스트 보강)을 반영해 커밋했고, 완료조건 10개 모두 통과로 판정했다. `npm test` 57건 통과. 약화된 테스트 없음.
새 지식: docs/knowledge/billing/vat-per-line-floor.md — 맞는 기존 항목이 없는 까닭: 팀 지식 항목이 아직 없고, 사람이 알려 준 부가세 규정이 이번 일을 넘어 통하는 규칙이라 남김
## 다음 task가 알아야 할 것
- 부가세 계산: `src/invoice/total.js`의 `lineVat`/`sumLineVat`
- 테스트: `test/vat-rule.test.js` (57건 중)
- 검증 문서: tasks/03-verify/verification.md, pr.md

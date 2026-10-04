---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(모두 사소)을 반영하지 않는다"
    why: "범위 밖이거나 변경 불필요. 사람이 반영하지 않음을 선택"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 할인 안분 returnedDiscount(credit-note.js:72)는 Math.round 그대로"
  - "저장된 반품 전표와 발행 청구서는 바뀌지 않는다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건이고 반영하지 않았다. 완료조건 7개 모두 통과했고 `npm test` 50건이 통과하며 INV-2031은 29,079원이다. 테스트 파일 변경은 추가뿐이라 약화가 아니다.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 맞는 기존 항목이 없는 까닭(항목 없음)
새 지식: docs/knowledge/invoice/issued-invoice-stored-totals.md — 맞는 기존 항목이 없는 까닭(항목 없음)
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `lineVat`, `src/invoice/credit-note.js:72` 할인 안분 반올림은 규칙 밖
- 검증: `npm test`, `node /tmp/repro.mjs`

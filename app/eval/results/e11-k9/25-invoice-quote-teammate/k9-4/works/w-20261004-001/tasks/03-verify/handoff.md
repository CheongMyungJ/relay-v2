---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 차단·권장(1번)만 반영하고 사소(2번)는 반영하지 않는다"
    why: "사람이 '차단·권장만 반영'을 선택함"
    by: human
assumptions:
  - "줄별 내림 기준은 할인 후 공급가액이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표 creditTotals와 견적서 quoteTotals는 합계 기준 반올림이라 청구서와 몇 원 다를 수 있음 (사람이 범위에서 뺌)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 권장 1건(영세율·면세 테스트)을 반영해 커밋했고, 7개 완료조건이 모두 통과했다. `npm test` 51개 통과, INV-2031은 29,079원이다.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없음
새 지식: docs/knowledge/invoice/issued-totals-not-recomputed.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없음
새 지식: docs/knowledge/invoice/format-output-is-fixed.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없음
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`: 줄별 내림 부가세
- 추가 테스트: `test/total.test.js` 끝 3개
- 미적용: `src/invoice/credit-note.js` creditTotals, `src/invoice/quote.js` quoteTotals
- 커밋: 3e5d67e(테스트), 지식 커밋

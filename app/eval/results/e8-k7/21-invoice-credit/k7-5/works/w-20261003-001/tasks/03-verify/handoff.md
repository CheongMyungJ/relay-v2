---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(영세율 테스트 없음, 사소)을 반영하지 않는다"
    why: "사소한 지적이고 기존 동작은 그대로라 범위를 넓히지 않는다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "영세율 경로 vat 0은 새 테스트가 없음"
  - "반품 전표 수정은 intent 밖 범위 확장이며 사람이 승인함. 저장된 반품 전표 합계는 다시 계산하지 않음"
  - "발행된 청구서의 저장 합계와 새로 계산한 값이 다를 수 있음 (의도된 비목표)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(사소)은 사람이 반영하지 않기로 했다. 완료조건 7개 모두 통과, `npm test` 49개 통과, INV-2031 합계 29,079원을 다시 확인했다. verification.md와 pr.md를 썼다.
남긴 지식: docs/knowledge/vat-per-line-floor.md, docs/knowledge/discount-before-vat-per-line.md, docs/knowledge/issued-invoice-keep-stored-totals.md, docs/knowledge/format-dir-output-unchanged.md
## 다음 task가 알아야 할 것
- 부가세 계산: `src/invoice/vat.js`의 `rowsVat`. 청구서와 반품 전표가 같이 쓴다.
- 확인 명령: `npm test` (49개), 재현은 `computeTotals(createInvoice(examples/INV-2031.json))` → vat 2641, total 29079.

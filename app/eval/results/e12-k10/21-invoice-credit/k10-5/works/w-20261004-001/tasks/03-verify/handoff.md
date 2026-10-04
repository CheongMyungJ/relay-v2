---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(사소)을 반영하지 않는다"
    why: "사람이 반영하지 않음을 선택"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표 수정은 intent 본문 밖이다. 반품 테스트의 수정 전 실패는 실행으로 확인하지 못함"
  - "반품 전표 영세율 테스트 없음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 사소 2건, 반영 없음. 완료조건 7개 모두 통과, `npm test` 50개 통과, 테스트 파일 변경은 추가만이라 약화 아님. `verification.md`, `pr.md` 작성.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 기존 항목 없음, 부가세 줄별 버림 규칙(반품 전표 포함)
새 지식: docs/knowledge/invoice/issued-invoice-stored-totals.md — 기존 항목 없음, 발행 청구서 저장 합계 사용과 src/format 불변
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `sumLineVat`: 줄별 floor 합산, 청구서와 반품 전표가 공유
- 재현: `computeTotals(createInvoice(examples/INV-2031.json))` → vat 2641, total 29079
- 테스트: `npm test`

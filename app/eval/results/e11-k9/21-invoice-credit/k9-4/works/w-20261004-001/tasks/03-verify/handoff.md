---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 3건(모두 사소)을 반영하지 않는다"
    why: "사람이 '반영하지 않음'을 선택"
    by: human
assumptions:
  - "공급가액이 음수인 줄은 없다고 가정 (Math.floor)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "일부 수량 반품의 부가세는 반품 줄 기준 버림이라 원 청구서와 1원 차이가 날 수 있음"
  - "반품 전표 수정은 intent 범위를 넓힌 것. 기존 전표는 저장 합계를 써서 영향 없음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 3건(사소)은 반영하지 않았다. 완료조건 6개 모두 통과, 테스트 파일은 추가만 있어 약화 아님.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 맞는 기존 항목이 없는 까닭: docs/knowledge가 비어 있었음
## 다음 task가 알아야 할 것
- `npm test`: 49 통과. INV-2031 직접 실행 vat 2641 / total 29079
- `src/invoice/total.js` `lineVat`, `src/invoice/credit-note.js:91` `creditTotals`
- 산출물: tasks/03-verify/verification.md, pr.md

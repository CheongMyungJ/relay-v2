---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(사소, lineVat의 assertWon 누락)을 반영하지 않음"
    why: "사람이 반영하지 않음을 선택. 호출부 net이 이미 정수 원이고 sumWon이 결과를 검사함"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "발행 전 청구서·견적서·새 반품 전표의 합계가 바뀐다. 저장된 전표(INV-2047 저장 부가세 5,801, CN-0112 1,742)는 그대로라 기준이 다르다"
  - "이미 보낸 견적과 새로 계산한 견적 값이 다를 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(사소)은 사람이 반영하지 않기로 했다. 완료조건 7개 모두 통과: INV-2031 직접 계산 2,641/29,079, `npm test` 57개 통과, 테스트는 추가만 있고 `src/format/` 변경 없음. 지식 파일을 남겼다.
새 지식: docs/knowledge/vat/line-floor-vat.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없음
새 지식: docs/knowledge/vat/issued-invoice-stored-totals.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없음
## 다음 task가 알아야 할 것
- `src/invoice/total.js:17` `lineVat`를 청구서·견적서(`quote.js:40`)·반품 전표(`credit-note.js:91`)가 공유
- 발행 청구서는 `invoiceTotals`(`invoice.js`)가 저장값을 쓰고 `test/invoice.test.js:33`이 확인
- 산출물: verification.md, pr.md

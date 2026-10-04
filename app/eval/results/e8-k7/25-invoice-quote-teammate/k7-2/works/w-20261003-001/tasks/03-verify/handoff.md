---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 권장(2번)만 반영하고 사소(1번)는 반영하지 않는다"
    why: "사람이 '차단·권장만 반영'을 골랐다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "할인이 있는 견적의 금액이 이전과 달라질 수 있다"
  - "반품 전표 부분 반품 할인 반올림(returnedDiscount)은 그대로"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 후 모든 완료조건 7건 통과. `npm test` 53개 통과, INV-2031 29,079원 재현 확인.
남긴 지식: docs/knowledge/vat-floor-per-line.md, docs/knowledge/discount-before-vat.md, docs/knowledge/issued-invoice-keeps-stored-totals.md
## 다음 task가 알아야 할 것
- 커밋 091271a: quote.js 삼항식 정리, test/total.test.js 영세율 테스트 추가
- 명령: `npm test`
- `src/format/` 변경 없음, 기존 테스트 삭제·수정 없음

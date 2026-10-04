---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 사소 2건을 반영하지 않는다"
    why: "사람이 반영하지 않음을 골랐다"
    by: human
assumptions:
  - "고객센터 규칙은 237P에서 역산한 것이라 다른 주문 값은 대조하지 못했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 포인트 회수(`src/orders/refund.js:34`)는 반올림이라 새 적립과 1P 어긋날 수 있다"
  - "선물하기 적립은 배송비 포함·반올림 기준 그대로다 (비목표)"
recommended_next: null
knowledge_candidates: []
---
## 요약
완료조건 6개 모두 통과. 재현 절차 237P, `npm test` 22개 통과. 지적은 사소 2건이고 반영하지 않았다. verification.md와 pr.md를 썼다.
남긴 지식: docs/knowledge/no-recalc-saved-points.md, docs/knowledge/receipt-text-unchanged.md, docs/knowledge/gift-points-hands-off.md, docs/knowledge/regular-order-points-rule.md
## 다음 task가 알아야 할 것
- 수정 위치: `src/points/earn.js:6`, 테스트 `test/earn.test.js`.
- `src/format/`, `src/gift/gift-points.js`는 바뀌지 않았다.
- 환불 회수 반올림 불일치는 `refund.js:34`.

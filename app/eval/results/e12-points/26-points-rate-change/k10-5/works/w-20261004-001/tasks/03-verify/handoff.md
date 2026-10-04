---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수도 새 적립 기준으로 고친다(쿠폰·사용 포인트를 환불 상품 금액 비율로 나눠 버림)"
    why: "사람이 환불도 같은 적립 규정이어야 한다고 정함"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(gift-points.js)은 배송비 포함, 반올림 그대로라 일반 주문과 차이가 난다(범위에서 뺌)"
  - "이미 저장된 주문의 points.earned는 바뀌지 않는다. 다만 옛 주문의 부분 환불 회수액은 새 식으로 계산된다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(부분 환불 회수가 옛 기준)을 사람이 골라 반영했다. 완료조건 5개 모두 반영 후 재실행해 통과(O-1042 237P, npm test 26건).
새 지식: docs/knowledge/points/earn-basis.md — 맞는 기존 항목이 없는 까닭: docs/knowledge가 비어 있었고 적립 기준 규칙과 선물하기 미정 사항을 한 항목에 남김
## 다음 task가 알아야 할 것
- 적립 기준 규칙: `docs/knowledge/points/earn-basis.md`
- 부분 환불: `src/orders/refund.js` 회수 = floor(환불 상품 금액 × earnBase ÷ 상품 금액 × 1%), `earnBase`는 `src/points/earn.js`
- 선물하기 적립 `src/gift/gift-points.js:6`은 `percentOf(total)` 그대로(미정)

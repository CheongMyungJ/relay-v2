---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준은 배송비를 뺀 금액(상품−쿠폰−사용 포인트)의 1%, 소수점 내림"
    why: "O-1042에서 237P가 나오는 기준이고 사람이 선택함"
    by: human
  - what: "일반 주문과 선물하기 주문의 적립을 함께 고친다"
    why: "gift-points.js도 같은 방식으로 적립함"
    by: human
assumptions:
  - "다른 주문의 '조금씩 많음'도 같은 기준 차이로 본다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불의 포인트 회수(refund.js)는 상품 금액 1% 반올림이라 새 적립 기준과 어긋날 수 있다. 이번 범위에서는 제외"
recommended_next: null
knowledge_candidates:
  - "포인트 적립 기준은 배송비를 뺀 금액의 1% 내림이다 (사람)"
---
## 요약
적립 기준(배송비 제외, 내림)과 범위(일반+선물하기)를 확인해 intent 초안을 썼다.
## 다음 task가 알아야 할 것
- `src/points/earn.js:5`, `src/gift/gift-points.js:6`: 둘 다 `percentOf(order.amounts.total, POINT_RATE_PERCENT)`로 적립
- `src/money.js`의 `percentOf`는 반올림. `amounts.total`은 배송비 포함, 사용 포인트 차감 후
- O-1042: 상품 28,270 − 쿠폰 3,000 + 배송비 3,000 − 포인트 1,500 = 26,770 → 현재 268P, 기대 237P
- `src/orders/refund.js:34` 부분 환불 회수는 `percentOf(refundGoods, ...)`로 별도 계산
- 테스트: `npm test` (현재 20개 통과)

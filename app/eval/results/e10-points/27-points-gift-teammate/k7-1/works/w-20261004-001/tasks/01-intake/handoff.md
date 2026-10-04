---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준은 배송비 제외, 소수점 버림"
    why: "O-1042의 237P(23,770원 × 1% = 237.7)와 맞는 유일한 조합"
    by: human
  - what: "사용 포인트는 적립 기준 금액에서 계속 뺀다"
    why: "사람이 확인함"
    by: human
assumptions:
  - "다른 주문의 적립이 많게 나오는 것도 같은 기준 차이(배송비 포함, 반올림) 때문이라고 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(giftPoints)도 같은 식(total 기준 반올림)이라 같은 차이가 있을 수 있으나 이번에는 손대지 않음"
  - "기존 테스트(test/order.test.js 등)의 기대값이 바뀔 수 있음"
recommended_next: null
knowledge_candidates:
  - "일반 주문 적립 기준은 배송비를 뺀 금액(상품-쿠폰-사용 포인트)의 1%, 원 단위 버림이다 (사람)"
---
## 요약
일반 주문 적립을 적립 안내 기준(배송비 제외, 소수점 버림)으로 맞추는 의도 초안을 썼다. 선물하기와 영수증 글자는 건드리지 않는다.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: 지금은 `amounts.total`(배송비 포함)에 `percentOf`(반올림)를 쓴다. 호출처는 `src/orders/order.js:35`.
- O-1042: 상품 28,270 − 쿠폰 3,000 + 배송비 3,000 − 포인트 1,500 = 26,770 → 268P. 안내 기준 23,770 → 237P.
- `src/gift/gift-points.js`는 같은 식을 복제했으나 수정 금지.
- 테스트: `npm test`(node --test). `test/order.test.js:26`은 적립 500을 기대하므로 확인 필요.

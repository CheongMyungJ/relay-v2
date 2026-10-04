---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준은 배송비 제외, 쿠폰·포인트 사용 차감 후 상품 금액의 1%, 소수점은 버림"
    why: "O-1042가 237P가 되는 기준으로 사람이 고름"
    by: human
  - what: "범위는 주문 적립(src/points/earn.js)과 환불 포인트 회수(src/orders/refund.js). 선물하기 적립은 비목표"
    why: "적립과 회수 기준이 어긋나면 안 맞는다는 사람의 요청으로 환불 회수를 범위에 넣음"
    by: human
assumptions:
  - "소수점 버림은 O-1042의 237P와 맞는 방식으로 정함. 안내문 원문은 보지 못함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(gift-points.js)은 옛 기준(결제 금액 반올림)이 남아 선물 주문의 적립과 회수가 어긋날 수 있음"
  - "부분 환불 회수의 정확한 계산식(쿠폰·포인트 차감분 안분 여부)은 정하지 않았음. fix에서 적립 기준과 맞는 식을 고르고 근거를 남길 것"
recommended_next: null
knowledge_candidates:
  - "아직 규칙을 따르지 않음: src/gift/gift-points.js — 선물하기 적립은 옛 기준(결제 금액 반올림), 사람이 이번 범위에서 뺌 (사람)"
  - "환불 시 포인트 회수는 적립과 같은 기준에 맞아야 한다 (사람)"
  - "적립 기준: 배송비 제외, 쿠폰·포인트 사용 차감 후 상품 금액의 적립률%, 소수점 버림. 고객센터 적립 안내 기준 (사람)"
---
## 요약
일반 주문 적립이 안내보다 많게 나오는 버그의 의도 초안을 썼다. 사람 요청으로 환불 포인트 회수를 범위에 넣었고 선물하기는 뺐다.
## 다음 task가 알아야 할 것
- 현재 `src/points/earn.js:6`은 `percentOf(order.amounts.total, POINT_RATE_PERCENT)`이고 `total`은 배송비를 더하고 포인트를 뺀 값이다. `percentOf`는 반올림(`src/money.js`).
- O-1042: goods 28,270, coupon 3,000, shipping 3,000, pointsUsed 1,500, total 26,770 → 현재 268P. 기대 23,770 → 237P.
- `src/orders/order.js:36`이 `earnPoints(order)`를 호출해 `points.earned`를 저장한다. 영수증은 저장값을 쓴다.
- 같은 기준을 쓰는 곳: `src/orders/refund.js:34`(부분 환불 회수 `percentOf(refundGoods, rate)`, 범위 안), `src/gift/gift-points.js`(범위 밖). 전체 취소는 `refund.js:42`에서 저장값 사용. `test/refund.test.js`에 회수 100P, 500P 단정이 있다.
- 테스트: `npm test`. `test/order.test.js:26`에 적립 500 단정이 있어 기준 변경에 영향받을 수 있다.

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준은 배송비 제외, 소수점 버림으로 한다"
    why: "사람이 선택. O-1042가 23,770원의 1% = 237P로 요청의 237P와 맞는다"
    by: human
  - what: "선물하기 적립은 이번 범위에서 뺀다"
    why: "사람이 선택. 요청이 일반 주문과 earn.js에 한정됨"
    by: human
assumptions:
  - "다른 주문도 같은 규정으로 계산되어야 한다고 가정함(요청의 '다른 주문도 조금씩 많다')"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(gift-points.js)은 같은 계산식이라 같은 차이가 남을 수 있음(범위에서 뺌)"
  - "이미 저장된 주문의 points.earned는 이번 범위에서 다루지 않음"
recommended_next: null
knowledge_candidates:
  - "정하지 않음: 선물하기(gift-points.js) 적립에 같은 기준을 적용할지 — 사람이 이번 범위에서 뺌, 지금 코드는 결제 금액(배송비 포함)의 1% 반올림 (사람)"
---
## 요약
O-1042 적립이 268P로 나오는 문제의 의도를 정리했다. 기대 기준은 사람이 정했다: 배송비 제외, 소수점 버림, 237P. 선물하기는 제외.
## 다음 task가 알아야 할 것
- `src/points/earn.js:5`: `percentOf(order.amounts.total, POINT_RATE_PERCENT)` 사용. `total`은 배송비 포함, 사용 포인트 차감 후 금액이고 `percentOf`는 반올림(`src/money.js`).
- 호출처 `src/orders/order.js:35`. 같은 식이 `src/gift/gift-points.js:6`에도 있음.
- O-1042 계산: 상품 28,270 − 쿠폰 3,000 + 배송비 3,000 − 포인트 1,500 = 26,770 → 268P. 기대는 23,770 → 237P.
- 테스트: `npm test`. 기존 `test/order.test.js:24`는 25,000×2 무료배송 주문의 500P.

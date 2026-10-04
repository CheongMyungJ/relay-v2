---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준은 배송비 제외(상품 − 쿠폰 − 사용 포인트), 소수는 버림"
    why: "O-1042가 237P가 되는 유일한 조합이며 사람이 선택함"
    by: human
  - what: "과거 저장 주문의 적립 포인트 보정은 이번 범위에서 제외"
    why: "사람이 포함하지 않음을 선택함"
    by: human
assumptions:
  - "선물하기 주문(G-xxxx)도 같은 적립 규칙을 따른다고 가정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "적립 안내 원문을 확인하지 못함. O-1042 한 건에 맞춘 규칙임"
  - "환불 시 포인트 회수는 저장된 적립값을 쓰므로 과거 주문과 새 주문의 회수액이 달라질 수 있음"
recommended_next: null
knowledge_candidates:
  - "적립 포인트 규칙: 배송비를 뺀 금액(상품 − 쿠폰 − 사용 포인트)의 적립률, 원 단위 버림 (사람)"
---
## 요약
적립 포인트가 배송비를 포함하고 반올림해서 많게 나오는 문제의 의도를 정리했다. 과거 주문 보정은 범위 밖이다.
## 다음 task가 알아야 할 것
- `src/points/earn.js:6`: `percentOf(order.amounts.total, ...)`. `total`에는 배송비가 포함되고 `percentOf`는 반올림(`src/money.js`).
- `src/gift/gift-points.js:6`도 같은 식을 쓴다.
- O-1042: 상품 28,270 − 쿠폰 3,000 + 배송비 3,000 − 포인트 1,500 = 26,770 → 현재 268P. 기대는 23,770 → 237P.
- 테스트는 `npm test`. `test/order.test.js:26`, `test/receipt.test.js:18`(290P)의 기대값이 바뀔 수 있음.

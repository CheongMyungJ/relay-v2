---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준은 배송비를 뺀 금액(상품 − 쿠폰 − 사용 포인트)의 적립률%, 소수점 버림"
    why: "고객센터 안내가 237P이고 이 계산이 맞다고 사람이 확인함"
    by: human
  - what: "선물하기 적립과 환불 포인트 회수까지 같은 규칙으로 맞춘다"
    why: "세 곳이 같은 계산식을 써서 어긋나지 않게 하려는 사람의 선택"
    by: human
assumptions:
  - "이미 저장된 주문의 적립 포인트는 소급 수정하지 않는다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "환불 회수(refund.js)는 상품 금액 기준이라 적립 기준(쿠폰·포인트 차감)과 비율이 어긋날 수 있어, 부분 환불 회수식의 구체적 정의를 fix에서 정해야 함"
recommended_next: null
knowledge_candidates:
  - "적립 포인트는 배송비를 뺀 금액(상품 − 쿠폰 − 사용 포인트)의 적립률%, 소수점 버림이 고객센터 적립 안내 규칙이다 (사람)"
---
## 요약
O-1042 적립 예정 268P를 안내대로 237P로 고치는 의도를 정리했다. 규칙은 배송비 제외, 버림이고, 선물하기와 환불 회수도 범위에 포함한다.
## 다음 task가 알아야 할 것
- 현재 계산: `src/points/earn.js:6`이 `order.amounts.total`(배송비 포함, 포인트 차감 후)을 `percentOf`로 반올림. O-1042는 26,770원 → 267.7 → 268P.
- 목표 기준: 28,270 − 3,000 − 1,500 = 23,770원 → 237P.
- 같은 식: `src/gift/gift-points.js:6`, `src/orders/refund.js:34`(부분 환불 `percentOf(refundGoods, ...)`).
- `src/money.js`의 `percentOf`는 반올림, 버림 도우미는 `floorTen`뿐이다.
- 테스트는 `npm test`(20개 통과), 적립 관련은 `test/gift.test.js:14`, `test/receipt.test.js`.
- 예시 데이터: `examples/O-1042.json`, `G-0213.json`, `O-1077.json`.

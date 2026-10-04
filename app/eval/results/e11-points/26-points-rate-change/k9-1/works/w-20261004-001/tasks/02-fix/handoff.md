---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "선물하기 적립은 earnPoints를 그대로 쓰고, 부분 환불 회수도 버림으로 바꾼다"
    why: "완료조건: 적립 포인트를 쓰는 다른 경로가 같은 계산 결과와 어긋나지 않는다"
    by: ai
assumptions:
  - "환불 회수는 상품 금액 기준 버림이면 충분하다고 보았다(쿠폰·사용 포인트 안분은 하지 않음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 회수는 환불 상품 금액 기준이라 쿠폰·사용 포인트가 있는 주문에서는 적립 기준과 완전히 비례하지 않는다(기존 동작)"
  - "원 단위 버림이라 여러 번 부분 환불하면 회수 합이 적립분과 1~2P 다를 수 있다"
recommended_next: null
knowledge_candidates:
  - "적립 포인트는 배송비를 뺀 금액(상품 금액 − 쿠폰 − 사용 포인트)의 적립률%를 원 단위로 버림한다. 일반·선물하기·부분 환불 회수 모두 같은 규칙 (사람)"
---
## 요약
적립 계산에서 배송비를 빼고 버림하도록 고쳤다. O-1042는 237P가 나온다. 선물하기와 부분 환불 회수도 같은 규칙에 맞췄고, `npm test`는 24개 모두 통과한다.
## 다음 task가 알아야 할 것
- `src/points/earn.js:5`: 적립 계산 본체
- `src/money.js` `percentFloor`: 새 버림 도우미
- `src/gift/gift-points.js`: `earnPoints` 위임
- `src/orders/refund.js:34`: 회수를 `percentFloor`로 바꿈
- 저장된 과거 주문은 건드리지 않음(비목표)

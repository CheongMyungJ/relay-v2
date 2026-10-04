---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준은 상품 금액 − 쿠폰 − 사용 포인트의 1%, 배송비 제외, 1P 미만 버림"
    why: "사람이 적립 규정으로 직접 알려 줌 (O-1042 = 237P)"
    by: human
assumptions:
  - "이번 범위는 일반 주문 적립(earn.js)이다. 선물하기 적립과 환불 회수는 요청에 없어 비목표로 적지 않고 fix에서 확인하게 둔다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/gift/gift-points.js도 같은 방식(결제 금액 반올림)으로 적립을 계산한다. 같은 규정을 적용할지 사람 확인이 필요할 수 있다"
  - "src/orders/refund.js:34의 회수 포인트(상품 금액 기준 반올림)가 새 적립 규정과 맞는지 확인되지 않았다"
recommended_next: null
knowledge_candidates:
  - "적립 규정: 상품 금액에서 쿠폰 할인과 사용한 포인트를 뺀 금액의 1%, 배송비는 적립 제외, 1P 미만은 버림(반올림 아님) (사람)"
  - "이미 적립된 포인트는 주문에 저장된 값을 그대로 쓰고 다시 계산하지 않는다. 영수증 글자(src/format/)는 바뀌면 안 된다 (사람)"
---
## 요약
적립 예정 포인트를 사람이 알려 준 규정대로 고치는 bugfix 의도를 정리했다. O-1042는 237P가 되어야 한다.
## 다음 task가 알아야 할 것
- `src/points/earn.js:6`: `percentOf(order.amounts.total, POINT_RATE_PERCENT)` (total은 배송비 포함, 사용 포인트 차감 후, 반올림)
- O-1042: 상품 28,270 − 쿠폰 3,000 − 포인트 1,500 = 23,770 → 237P. 현재 total 26,770 → 268P
- 같은 방식 계산: `src/gift/gift-points.js:6`, 회수 `src/orders/refund.js:34`
- `src/money.js`의 `percentOf`는 반올림. 테스트 `npm test` 20개 통과 상태, `test/receipt.test.js:18`이 290P를 기대

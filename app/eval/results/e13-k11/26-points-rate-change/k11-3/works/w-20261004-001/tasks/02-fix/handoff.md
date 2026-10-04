---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "선물하기 적립은 earnPoints에 위임해 일반 주문과 같은 코드를 쓴다"
    why: "규칙이 두 곳에서 다시 어긋나지 않게 하려고"
    by: ai
  - what: "부분 환불 회수는 환불 상품 금액의 1%를 버림한다 (쿠폰과 사용 포인트는 빼지 않음)"
    why: "환불은 쿠폰과 사용 포인트를 남은 주문에 두는 구조이고, intake가 버림 규칙 적용으로 해석함"
    by: ai
assumptions:
  - "부분 환불 회수에는 버림만 적용하고 쿠폰/사용 포인트 차감은 적용하지 않는다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불을 여러 번 하면 회수 합계가 적립분과 1P 안팎으로 다를 수 있음"
  - "`percentOf`는 더 이상 쓰이지 않지만 남겨 둠"
recommended_next: null
knowledge_candidates:
  - "적립(일반, 선물하기)은 `earnPoints`, 부분 환불 회수는 `floorPercentOf`로 버림 계산한다. 적립 기준은 배송비 제외 (상품 − 쿠폰 − 사용 포인트)의 1% (사람)"
---
## 요약
적립, 선물하기 적립, 부분 환불 회수를 배송비 제외, 버림 규칙으로 고쳤다. O-1042는 237P, G-0213은 218P가 된다. `npm test` 24건이 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js:6`, `src/gift/gift-points.js`, `src/orders/refund.js:34`, `src/money.js`의 `floorPercentOf`
- 재현 테스트 4건 추가(order 2, gift 1, refund 1). 기존 테스트는 바꾸지 않음
- 확인: `node src/cli.js examples/O-1042.json`, `npm test`

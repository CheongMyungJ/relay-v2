---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "적립 포인트 = (상품 금액 − 쿠폰 − 사용 포인트)의 1%, 배송비 제외, 1P 미만 버림"
    why: "사람이 답으로 알려 준 적립 안내 규칙. O-1042는 28270−3000−1500=23770 → 237P"
    by: human
  - what: "선물하기 적립과 환불 포인트 회수도 같이 맞춘다"
    why: "사람이 범위에 포함하기로 답함"
    by: human
assumptions:
  - "환불 시 포인트 회수는 새 적립 규칙과 같은 방식으로 계산하는 것이 맞다고 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불에서 쿠폰·포인트 사용분을 환불 금액에 어떻게 배분할지 요청에 없음"
  - "이미 저장된 points.earned와 새 규칙 값이 다른 주문이 있어도 다시 계산하지 않는다(요청 제약)"
recommended_next: null
knowledge_candidates:
  - "적립 포인트는 상품 금액에서 쿠폰 할인과 사용한 포인트를 뺀 금액의 1%이고 배송비에는 적립하지 않는다. 1P 미만은 버리고 반올림하지 않는다 (사람)"
  - "이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다. 영수증 글자(src/format/)는 바뀌면 안 된다 (사람)"
---
## 요약
O-1042 적립이 268P로 나오는데 안내 규칙으로는 237P다. 사람이 알려 준 규칙과 범위(선물하기, 환불 회수 포함)로 intent 초안을 썼다.
## 다음 task가 알아야 할 것
- 적립 계산: `src/points/earn.js:6`(`percentOf` 반올림 사용, `src/money.js`), 선물 `src/gift/gift-points.js:6`, 환불 회수 `src/orders/refund.js:34`. 저장은 `src/orders/order.js:35`.
- 참고(가설, 확인 안 됨): 현재 코드는 `amounts.total`을 기준으로 반올림한다. O-1042 입력으로 268은 배송비 포함 금액(26770)의 1%와 맞는다.
- 테스트: `npm test`(node --test). 데이터 `examples/O-1042.json`.

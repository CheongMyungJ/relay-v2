---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준은 (상품 금액 − 쿠폰 할인 − 사용 포인트)의 1%, 배송비 제외, 1P 미만 버림"
    why: "사람이 적립 규정으로 알려 줌. O-1042가 237P가 되는 기준"
    by: human
  - what: "범위는 신규 주문의 적립 계산만. 기존 적립분 재계산과 영수증 글자 변경은 비목표"
    why: "사람이 이미 적립된 값은 저장값 그대로, src/format/은 바뀌면 안 된다고 함"
    by: human
  - what: "선물하기 적립은 이번 범위 밖으로 두고 결과에 따로 적는다"
    why: "사람이 선물하기 규정을 잘 모른다고 함"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(src/gift/gift-points.js)은 고치지 않아 기존 방식 그대로이며, 같은 규정이 통하는지 확인되지 않음"
  - "환불 회수(src/orders/refund.js)도 percentOf(환불 상품 금액)로 계산해 적립 규정과 어긋날 수 있으나 이번 범위 밖"
recommended_next: null
knowledge_candidates:
  - "적립 규정: 상품 금액에서 쿠폰 할인과 사용한 포인트를 뺀 금액의 1%, 배송비 제외, 1P 미만 버림(반올림 아님) (사람)"
  - "이미 적립된 포인트는 재계산하지 않고 주문에 저장된 값을 그대로 쓴다 (사람)"
  - "src/format/ 영수증 글자는 앱과 메일이 그대로 보여 주므로 바뀌면 안 된다 (사람)"
---
## 요약
O-1042의 적립이 268P로 나오고 규정상 237P여야 해서, 적립 규정과 범위를 사람에게 확인받아 intent 초안을 썼다. 코드는 바꾸지 않았다.
## 다음 task가 알아야 할 것
- 적립 계산: `src/points/earn.js`가 `order.amounts.total`에 `percentOf`(반올림)를 쓴다. 호출은 `src/orders/order.js:35`.
- `order.amounts`에 `goods`, `coupon`, `shipping`, `pointsUsed`, `total`이 있다(`src/orders/order.js`).
- 같은 계산이 `src/gift/gift-points.js`(선물하기)와 `src/orders/refund.js:34`(환불 회수)에도 있다.
- 테스트는 `npm test`(`node --test`). 적립 전용 테스트 파일은 아직 없다.
- O-1042 기대값: 28,270 − 3,000 − 1,500 = 23,770원 → 237P.

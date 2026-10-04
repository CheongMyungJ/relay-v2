---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준액은 배송비 제외(상품−쿠폰−사용포인트), 1%를 원 단위 버림"
    why: "O-1042에서 237P와 일치하는 해석이며 사람이 선택함"
    by: human
  - what: "선물하기 적립과 부분 환불 회수도 같은 규칙으로 맞춘다"
    why: "사람이 범위에 포함하기로 선택함"
    by: human
assumptions:
  - "부분 환불 회수는 같은 규칙과 어긋나지 않게 맞추는 것으로 해석했고 구체 계산식은 fix에서 정한다"
rejected:
  - "배송비만 제외하고 반올림 유지: O-1042가 238P가 되어 237P와 맞지 않음"
open_questions: []
intent_deviation: null
risks:
  - "환불 회수 계산식(상품금액 기준)이 새 적립 규칙과 정확히 어떻게 맞아야 하는지 모호함"
  - "적립 안내 규칙 문서가 레포에 없어 고객센터 규칙은 사람 말에만 의존"
recommended_next: null
knowledge_candidates:
  - "포인트 적립 규칙: 배송비를 제외한 금액(상품금액−쿠폰−사용 포인트)의 적립률을 원 단위 버림한다 (사람)"
---
## 요약
O-1042 적립 예정 포인트가 안내(237P)보다 많은 문제의 intent 초안을 썼다. 규칙(배송비 제외, 버림)과 범위(선물하기, 환불 회수 포함)는 사람이 정했다.
## 다음 task가 알아야 할 것
- `src/points/earn.js:5`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`가 모두 `percentOf`(`src/money.js`, 반올림)로 적립률을 계산한다.
- O-1042 수치: 상품 28,270 − 쿠폰 3,000 + 배송비 3,000 − 포인트 1,500 = 결제 26,770 → 268P. 배송비 제외 23,770 → 237.7 → 버림 237.
- `createOrder`(`src/orders/order.js:35`)가 `earnPoints(order)`를 호출하며 order.amounts에 상품/쿠폰/배송비/사용포인트가 있다.
- 테스트: `npm test`(node --test).

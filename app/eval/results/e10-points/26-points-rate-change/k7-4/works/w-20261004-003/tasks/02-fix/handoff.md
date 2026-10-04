---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "선물하기 적립률은 별도 상수 `GIFT_POINT_RATE_PERCENT = 1`로 분리해 1%를 유지한다"
    why: "비목표: 선물하기 적립의 계산 방식은 바꾸지 않는다. 요청도 일반 주문의 기본 적립률만 올린다"
    by: ai
  - what: "환불 회수는 환불 상품 금액에 2% 버림만 적용하고 팀 지식의 '원래 적립 − 남은 상품 재계산' 방식은 넣지 않는다"
    why: "그 규칙은 머지 대기 중인 w-20261004-002의 범위라 중복·충돌을 피한다 (docs/knowledge/partial-refund-points-recovery.md)"
    by: ai
assumptions:
  - "기존 테스트의 적립 기대값(500, 100)은 1% 기준이라 2%에 맞게 고치는 것이 맞다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "기존 테스트 3건의 기대값·픽스처를 2%에 맞게 바꿨다(order 적립, refund 회수, cancel). 약화 여부는 verify가 판단"
  - "앞 Work(w-20261004-001, w-20261004-002)에서 고쳤을 수 있음, 머지 대기: 적립 기준액·환불 회수 코드가 겹치므로 머지 때 충돌 가능"
  - "1% 시절에 저장된 주문을 부분 환불하면 2%로 회수해 과다 회수된다. 원래 적립 기준 회수(앞 Work)가 머지돼야 정확"
recommended_next: null
knowledge_candidates:
  - "선물하기 적립률은 일반 주문과 별개 상수(`GIFT_POINT_RATE_PERCENT`)로 둔다. 일반 적립률을 올려도 선물하기는 따라가지 않는다"
---
## 요약
적립 기준액을 배송비 제외 금액으로, 소수점은 버림으로 고치고 적립률을 2%로 올렸다. O-1107은 486P. 선물하기는 별도 상수로 1% 유지. `npm test` 23건 통과.
## 다음 task가 알아야 할 것
- `src/points/earn.js:6` 적립, `src/orders/refund.js:34` 회수, `src/money.js` `percentOfFloor`, `src/config.js` 상수 두 개
- 기존 테스트 변경: test/order.test.js 적립 500→1000, test/refund.test.js 100→200/500→1000
- 재현: `node src/cli.js examples/O-1107.json`

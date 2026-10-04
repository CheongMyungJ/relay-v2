---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수(refund.js)는 건드리지 않고 1%(`POINT_RATE_PERCENT`)를 그대로 둔다. 적립용 `EARN_RATE_PERCENT = 2`를 따로 둔다"
    why: "사람 답: 환불 회수에 새 비율을 쓸지는 이번 범위가 아니고 정산팀과 따로 정한다"
    by: human
  - what: "적립 기준을 상품 − 쿠폰 − 사용 포인트(배송비 제외)와 1P 미만 버림으로 구현한다(`earnBase`)"
    why: "완료조건 O-1107 = 486P는 이 기준으로만 나온다(비율만 올리면 547P). docs/knowledge/points/earn-rule.md"
    by: ai
assumptions: []
rejected:
  - "POINT_RATE_PERCENT 값만 2로 변경: refund.js 회수까지 바뀌고, 배송비 포함 반올림이라 O-1107이 547P"
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 회수(refund.js:34)는 환불 상품 금액 × 1%로 그대로다. 새 2%로 적립된 주문을 부분 환불하면 회수가 적립의 절반 수준이다. 정산팀과 따로 정해야 한다"
  - "기존 테스트 기대값 변경: test/order.test.js(500→1000), test/gift.test.js(300→600), 비율 변경에 따른 값이다"
  - "앞 Work(w-20261004-002)에서 earnBase를 고쳤을 수 있음, 머지 대기. 머지 시 src/points/earn.js 충돌 가능"
  - "저장된 points.earned 유지는 코드를 새로 바꾸지 않았고 별도 테스트도 없다"
recommended_next: null
knowledge_candidates:
  - "정하지 않음: 부분 환불 회수에 새 적립률(2%)을 쓸지 — 정산팀과 따로 정함, 지금 코드는 refund.js가 POINT_RATE_PERCENT(1%)를 환불 상품 금액에 곱함 (사람)"
  - "적립률은 `EARN_RATE_PERCENT`(2%, 일반 주문과 선물하기)이고 `POINT_RATE_PERCENT`(1%)는 환불 회수용으로 남아 있다 (src/config.js)"
---
## 요약
일반 주문과 선물하기 적립을 2%로 올리고 기준 금액을 상품 − 쿠폰 − 사용 포인트(배송비 제외, 버림)로 맞췄다. O-1107은 486P다. 환불 회수는 사람 지시대로 건드리지 않았다.
## 다음 task가 알아야 할 것
- `src/config.js`: `EARN_RATE_PERCENT = 2`(적립), `POINT_RATE_PERCENT = 1`(refund.js만 사용).
- `src/points/earn.js`: `earnBase`, `earnPoints`. `src/gift/gift-points.js`는 earnPoints 호출.
- 재현 테스트 `test/earn.test.js`. `npm test` 22개 통과.
- 기존 테스트 2개 기대값을 2%에 맞춰 바꿨다(order, gift).

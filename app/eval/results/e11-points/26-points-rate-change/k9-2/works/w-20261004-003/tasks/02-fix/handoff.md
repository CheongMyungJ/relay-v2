---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "환불 회수와 선물하기는 기존 1% 상수로 분리하고 일반 주문 적립만 2%로 올린다"
    why: "비목표: 환불 회수 동작과 선물하기 계산을 바꾸지 않는다. 선물하기 기존 테스트(300P)도 유지된다"
    by: ai
  - what: "적립 계산을 팀 규칙대로 (상품−쿠폰−사용 포인트), 배송비 제외, Math.floor로 한다"
    why: "docs/knowledge/points/earn-rule.md 및 intent 제약"
    by: ai
assumptions:
  - "선물하기 적립률은 이번에 2%로 올리지 않는다고 보았다. 올리려면 GIFT_POINT_RATE_PERCENT만 바꾸면 되나 gift 테스트 기대값(300)이 바뀐다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "기존 테스트 변경: test/order.test.js '적립 포인트를 주문에 저장한다' 500→1000 (비율 변경 반영)"
  - "선물하기 포인트가 1%로 남아 일반 주문(2%)과 비율이 달라짐. 정책상 의도인지 확인 필요"
  - "앞 Work(w-20261004-002)에서 환불 계산을 고쳤을 수 있음, 머지 대기. 병합 시 refund.js 충돌 가능"
recommended_next: null
knowledge_candidates:
  - "적립률 2%(2026-10-04 배포~)는 일반 주문 새 주문에만 적용. 환불 회수(REFUND_RECOVER_RATE_PERCENT)와 선물하기(GIFT_POINT_RATE_PERCENT)는 1% 유지, 환불 회수 비율은 정산팀과 따로 정함 (사람)"
---
## 요약
O-1107 적립이 273P에서 486P가 되도록 `earnPoints`를 고치고 일반 주문 적립률을 2%로 올렸다. 환불 회수와 선물하기는 별도 상수(1%)로 분리해 값이 그대로다. `npm test` 22개 통과.
## 다음 task가 알아야 할 것
- `src/config.js`: `POINT_RATE_PERCENT=2`, `REFUND_RECOVER_RATE_PERCENT=1`, `GIFT_POINT_RATE_PERCENT=1`
- `src/points/earn.js:6`: floor((goods−coupon−pointsUsed)×rate/100)
- O-1077/R-0311 회수는 131P 유지(테스트 추가)
- 기존 테스트 1건 기대값 변경(order.test.js, 500→1000)
- 저장된 `points.earned`와 `src/format/`은 건드리지 않음

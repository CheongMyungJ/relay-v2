---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "환불 회수는 지금 비율(1%)을 유지하고, 환불 쪽에 별도 상수 REFUND_RECOVERY_RATE_PERCENT를 둔다"
    why: "사람이 환불 회수 비율은 정산팀과 따로 정한다며, 환불 동작과 기존 환불 테스트 기대값을 바꾸지 말고 필요하면 상수만 따로 두라고 함"
    by: human
  - what: "적립 계산은 earn.js의 earnBase/earnOn 한 식으로 통일하고 giftPoints는 이를 쓴다"
    why: "팀 지식 earn-rule.md: 계산식 복사 금지, 배송비 제외·버림"
    by: ai
assumptions:
  - "선물하기 주문도 일반 주문과 같은 규정·계산식을 쓴다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "기존 테스트 변경: test/order.test.js(earned 500→1000), test/gift.test.js(300→600). 적립률 2% 반영이며 약화 여부는 verify가 판단"
  - "intent는 환불 코드를 고치지 않는다고 했으나 사람 허락으로 refund.js의 상수 참조 한 줄을 바꿨다 (동작 불변, 환불 테스트는 그대로 통과)"
  - "환불 회수 1%, 적립 2%라 새 주문을 부분 환불하면 적립분보다 적게 회수된다. 정산팀 결정 대기"
  - "앞 Work(w-20261004-001, -002)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 비율은 적립률과 별개 상수(`REFUND_RECOVERY_RATE_PERCENT`, 현재 1%)다. 새 비율은 정산팀과 따로 정한다 (사람)"
  - "`POINT_RATE_PERCENT`를 바꿀 때 환불 회수에 번지지 않게 상수를 분리했다. 환불 회수율 변경은 정산팀 결정 뒤 별도 Work"
---
## 요약
적립을 배송비 제외·버림 한 식으로 통일하고 적립률을 2%로 올렸다. O-1107=486P, G-0213=437P. 환불 회수는 별도 상수로 1% 유지했다. `npm test` 22개 통과.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: earnBase/earnOn. `src/gift/gift-points.js`는 위임.
- `src/config.js`: POINT_RATE_PERCENT=2, REFUND_RECOVERY_RATE_PERCENT=1. `src/orders/refund.js:34`가 후자를 씀.
- 새 테스트 `test/earn.test.js`. 기존 테스트 변경은 order/gift 두 곳(기대값만).
- 이미 저장된 주문 값은 건드리지 않았고 `src/format/`은 변경 없음.

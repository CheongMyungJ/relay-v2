---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "환불 회수용 상수 POINT_RECOVER_RATE_PERCENT=1을 config에 추가하고 refund.js가 이를 쓰게 했다"
    why: "intent 제약: 회수를 1%로 고정하는 refund.js 최소 수정 허용"
    by: ai
  - what: "선물하기 적립은 earnPoints를 호출하게 했다"
    why: "팀 지식 docs/knowledge/points/earn-base-and-rounding.md: 계산은 earnPoints 한 곳"
    by: ai
assumptions:
  - "쿠폰 할인과 사용 포인트는 orderAmounts가 넣은 amounts.coupon, amounts.pointsUsed를 그대로 믿는다"
rejected:
  - "부분 환불 회수도 2% 적용: 사람이 범위 밖이라고 정정함"
open_questions: []
intent_deviation: null
risks:
  - "기존 테스트 2건의 적립 기대값을 2% 기준으로 고쳤다(order 500→1000, gift 300→600). 검증 강도는 같다"
  - "정산팀이 회수 비율을 정하면 POINT_RECOVER_RATE_PERCENT를 바꿔야 한다"
  - "앞 Work(w-20261004-001, -002)에서 고쳤을 수 있음, 머지 대기. refund.js와 earn.js에서 충돌할 수 있다"
recommended_next: null
knowledge_candidates:
  - "적립률은 POINT_RATE_PERCENT=2%, 환불 회수 비율은 POINT_RECOVER_RATE_PERCENT=1%로 분리했다. 회수에 새 비율을 쓸지는 정산팀과 따로 정한다 (사람)"
---
## 요약
적립 기준을 상품 − 쿠폰 − 사용 포인트(배송비 제외)로, 원 단위 버림으로 맞추고 적립률을 2%로 올렸다. O-1107은 486P다. 환불 회수는 1% 상수로 분리해 값이 그대로다. `npm test` 22건 통과.
## 다음 task가 알아야 할 것
- `src/config.js:9-11`: 적립률 2%, 회수율 1%
- `src/points/earn.js`: 적립 계산. `src/gift/gift-points.js`는 이를 호출
- `src/money.js`: `floorPercentOf` 추가
- `src/orders/refund.js:34`: 회수율 상수만 교체
- 수정 전 O-1107은 273P, 비율만 바꾸면 547P
- 테스트: `npm test`

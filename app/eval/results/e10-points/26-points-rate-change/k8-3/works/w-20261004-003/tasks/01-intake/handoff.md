---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준 금액(상품 − 쿠폰 − 사용 포인트, 배송비 제외)과 원 단위 버림을 이번 범위에 포함한다"
    why: "O-1107이 486P가 되려면 필요하다. 이 브랜치의 earnPoints는 배송비 포함 결제 금액을 반올림해 규정과 다르다"
    by: human
  - what: "환불 회수 동작은 그대로 두고, 회수 비율을 1%로 고정하는 데 필요한 refund.js 최소 수정은 허용한다"
    why: "회수에 새 비율을 쓸지는 정산팀과 따로 정한다. 적립률 상수를 바꾸면 refund.js가 따라 바뀌므로 분리가 필요하다"
    by: human
assumptions:
  - "'이미 적립된 포인트는 그대로'는 저장된 points.earned와 포인트 내역을 다시 계산하지 않는다는 뜻으로 읽었다"
  - "선물하기 적립도 일반 적립이므로 같은 기준·2%·버림을 쓴다고 보았다"
rejected:
  - "부분 환불 회수도 2% 적용: 사람이 범위 밖이라고 정정함"
open_questions: []
intent_deviation: null
risks:
  - "src/orders/refund.js:34가 POINT_RATE_PERCENT를 직접 쓴다. 상수를 2로 바꾸면 회수도 2%가 되므로 회수 비율을 1%로 고정해야 한다. 나중에 정산팀이 비율을 정하면 이 고정값을 바꿔야 한다."
  - "앞 Work(w-20261004-001, -002)에서 적립 규정이나 환불 회수를 고쳤을 수 있음, 머지 대기. 머지 뒤 충돌할 수 있다."
recommended_next: null
knowledge_candidates:
  - "기본 적립률을 1%에서 2%로 올림 (이번 배포부터, 저장된 주문의 포인트는 재계산하지 않음, 영수증 글자는 그대로) (사람)"
  - "환불 회수 포인트에 새 적립률을 쓸지는 정산팀과 따로 정한다. 적립률 변경 때 회수까지 같이 바꾸지 않는다 (사람)"
---
## 요약
적립률을 2%로 올리고 적립 기준(배송비 제외)과 버림 규정에 맞게 적립 계산을 맞추는 의도다. 환불 회수 동작은 그대로 두고, 비율을 1%로 고정하는 refund.js 최소 수정만 허용한다. O-1107은 486P여야 한다.
## 다음 task가 알아야 할 것
- 적립률은 `src/config.js:9`. 적립 계산: `src/points/earn.js:6`(`amounts.total` 사용, 배송비 포함), `src/gift/gift-points.js:6`(별도 계산). 둘 다 `percentOf`(`src/money.js`, 반올림)를 쓴다.
- 환불 회수 `src/orders/refund.js:34`도 `POINT_RATE_PERCENT`를 직접 쓴다. 상수만 바꾸면 회수가 2%가 된다. 계산 방식은 그대로 두고 비율만 1%로 고정한다(최소 수정 허용).
- O-1107: 상품 27,350, 쿠폰 2,000, 배송비 3,000, 사용 1,020. 기준 24,330 × 2% = 486.6 → 486. 지금 코드에 비율만 바꾸면 27,330 × 2% → 547.
- 참고 팀 지식: docs/knowledge/points/earn-base-and-rounding.md (기준 브랜치에는 아직 없음). 환불 회수 규칙 부분은 이번 범위 밖이다.
- 테스트: `npm test`.

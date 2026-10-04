---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준 금액은 상품금액 - 쿠폰 - 사용 포인트이고 배송비는 제외한다"
    why: "O-1042가 23,770원 기준 237P가 되어 고객센터 값과 맞는다"
    by: human
  - what: "적립 포인트의 소수점은 버린다"
    why: "23,770원 x 1% = 237.7P를 237P로 맞추기 위해"
    by: human
assumptions:
  - "적립 안내 문서가 저장소에 없어 사람의 답을 규칙으로 삼았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "gift 주문이 earnPoints를 공유하면 선물하기 적립도 바뀔 수 있다. 확인이 필요하다"
recommended_next: null
knowledge_candidates:
  - "포인트 적립 기준은 상품금액 - 쿠폰 - 사용 포인트이고 배송비는 제외, 소수점은 버린다 (사람)"
---
## 요약
O-1042 적립이 268P로 나오는 문제를 고치는 intent 초안을 썼다. 기준 금액과 끝수 처리는 사람이 정했다.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: 지금은 `percentOf(order.amounts.total, POINT_RATE_PERCENT)`이고 `src/money.js`의 `percentOf`가 반올림한다.
- O-1042 숫자: 상품 28,270 - 쿠폰 3,000 = 25,270, 배송비 +3,000 - 포인트 1,500 = 26,770 (현재 268P). 기대값은 23,770 → 237P.
- `src/gift/gift-points.js`가 `earnPoints`나 `percentOf`를 공유하는지 먼저 확인할 것. 공유하면 선물하기 결과가 바뀌지 않게 해야 한다.
- 테스트는 `npm test`(node --test).

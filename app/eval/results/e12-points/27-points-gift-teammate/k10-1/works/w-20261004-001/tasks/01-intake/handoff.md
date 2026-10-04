---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준은 배송비 제외, 쿠폰·포인트 사용 차감 후 상품 금액을 원 단위 버림"
    why: "O-1042에서 237P가 나오는 조합. 사람이 선택"
    by: human
assumptions:
  - "다른 주문도 같은 기준이 적용된다고 가정 (적립 안내 문서는 레포에 없음)"
rejected:
  - "배송비만 제외하고 반올림 유지: 238P라 고객센터 값 237P와 맞지 않음"
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(src/gift/gift-points.js)이 earnPoints를 공유하면 이번 수정이 영향을 줄 수 있음. 손대면 안 되므로 fix에서 확인 필요"
  - "환불의 적립 회수가 적립 기준에 의존하는지 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
주문 O-1042 적립이 268P로 나오는 버그의 의도를 정리했다. 기준은 배송비 제외, 쿠폰·포인트 차감 후 상품 금액 버림이고 기대값은 237P다.
## 다음 task가 알아야 할 것
- `src/points/earn.js:5`: 현재 `percentOf(order.amounts.total, POINT_RATE_PERCENT)`. total은 배송비를 포함하고 `money.js`의 `percentOf`는 반올림
- `src/orders/order.js:30`: `createOrder`가 `earnPoints(order)`를 호출해 `points.earned`로 저장
- O-1042: 상품 28,270 − 쿠폰 3,000 = 25,270, 배송비 3,000, 포인트 1,500, total 26,770 → 현재 268P
- 테스트는 `npm test`(node --test)

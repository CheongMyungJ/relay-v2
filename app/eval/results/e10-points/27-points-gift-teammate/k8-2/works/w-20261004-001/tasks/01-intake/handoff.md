---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "고객센터 적립 안내의 정확한 산식은 요청에 없고, 기대값은 O-1042의 237P뿐이다. 다른 주문의 기대값은 확인하지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "적립 안내 산식이 O-1042 한 건으로만 확인돼, 다른 주문에서 기준이 다를 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
O-1042 적립 예정 포인트가 268P로 나오는 문제(기대 237P)를 고치는 의도 초안을 썼다. 저장된 적립값 재계산, 영수증 글자, 선물하기 적립은 비목표다.
## 다음 task가 알아야 할 것
- 적립 계산: `src/points/earn.js`, 호출은 `src/orders/order.js`의 `createOrder`. 금액 도우미는 `src/money.js`, 적립률은 `src/config.js`의 `POINT_RATE_PERCENT`(1).
- 참고 수치(가설, 확인 안 됨): O-1042 상품 28,270 - 쿠폰 3,000 + 배송비 3,000 - 포인트 1,500 = 결제 26,770, 1%는 267.7이라 반올림하면 268이다. 237은 배송비를 뺀 23,770의 1%를 내림한 값과 맞는다.
- 테스트: `npm test`, 재현: `node src/cli.js examples/O-1042.json`.

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "고객센터 계산값 237P를 O-1042의 기대 결과로 삼는다"
    why: "요청에 명시됨"
    by: human
  - what: "선물하기 적립, 영수증 글자, 이미 적립된 값 재계산은 비목표로 둔다"
    why: "요청에 명시됨"
    by: human
assumptions:
  - "'다른 주문도 적립이 많게 나온다'는 같은 원인의 증상으로 보고 같은 수정으로 해결되는 것으로 가정했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "적립 기준 금액(포인트 사용분 차감 여부 등)에 대한 사람의 규정이 요청에 없다. 고객센터 기준 237P만 근거다"
recommended_next: null
knowledge_candidates: []
---
## 요약
O-1042 적립 예정 포인트를 268P에서 237P로 바로잡는 bugfix intent 초안을 썼다. 저장된 적립 값 재계산, 영수증 글자, 선물하기 적립은 건드리지 않는다.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: `earnPoints`가 `order.amounts.total`의 `POINT_RATE_PERCENT`(1)%를 계산한다. `src/orders/order.js` `createOrder`가 `points.earned`로 저장한다.
- `examples/O-1042.json`: 상품 17,800+10,470, 쿠폰 3,000, 사용 포인트 1,500. 237P는 23,770원의 1%와 일치한다.
- 테스트: `npm test` (`node --test`).
- 이 변경은 코드를 고치지 않았고 원인도 확인하지 않았다.

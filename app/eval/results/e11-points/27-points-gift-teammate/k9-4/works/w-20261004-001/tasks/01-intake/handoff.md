---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "고객센터 계산 기준은 O-1042의 237P 하나뿐이라고 보고, 다른 주문은 같은 기준을 따른다고 가정했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "고객센터 계산 규칙(어떤 금액에 몇 %, 반올림 방식)이 요청에 없어 fix에서 237P를 만족하는 규칙을 찾아야 한다"
  - "선물하기 적립(src/gift/gift-points.js)이 같은 계산을 공유하면 건드리지 않고 고치는 방법이 필요하다"
recommended_next: null
knowledge_candidates: []
---
## 요약
일반 주문 적립 예정 포인트가 고객센터보다 많은 버그의 의도 초안을 썼다. 기대값은 O-1042에서 237P이다. 저장된 적립 값, 영수증 글자, 선물하기 적립은 건드리지 않는다.
## 다음 task가 알아야 할 것
- 적립 계산: `src/points/earn.js` (`earnPoints`)는 `order.amounts.total`에 `POINT_RATE_PERCENT`(`src/config.js`)를 `percentOf`(`src/money.js`)로 적용한다. 호출은 `src/orders/order.js:35`.
- 참고용 가설(확인 안 됨): O-1042의 `amounts.total`은 26770이고 268P가 나온다. 237P는 배송비와 포인트 사용 전후 금액을 달리 보면 나오는 값일 수 있다.
- 테스트: `npm test` (`node --test`). `test/order.test.js:26`은 적립 500을 기대한다.
- 선물하기: `src/gift/gift-order.js:36`이 `giftPoints`를 쓴다. 수정 금지.

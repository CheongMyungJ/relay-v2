---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "기대값은 요청에 적힌 고객센터 계산 237P로 본다. 어떤 금액을 적립 기준으로 삼는지는 사람이 밝히지 않았으므로 fix에서 확인한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(`src/gift/gift-points.js`)이 같은 계산 함수를 쓰면, 공유 코드를 고칠 때 선물하기 결과가 달라질 수 있다"
recommended_next: null
knowledge_candidates:
  - "이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다 (사람)"
  - "선물하기 적립(`src/gift/gift-points.js`)은 다른 팀과 같이 보고 있어 함부로 바꾸지 않는다 (사람)"
---
## 요약
O-1042 적립 예정 포인트가 268P로 나오고 고객센터 계산은 237P라는 버그의 의도 초안을 썼다. 저장된 적립 값, 영수증 글자, 선물하기 적립은 바꾸지 않는 것을 비목표로 두었다.
## 다음 task가 알아야 할 것
- 적립 계산: `src/points/earn.js`의 `earnPoints`는 `order.amounts.total`의 `POINT_RATE_PERCENT`%(1%)를 `percentOf`로 반올림한다.
- 참고(가설, 확인 안 됨): O-1042를 손으로 계산하면 상품 28,270원 - 쿠폰 3,000 - 포인트 1,500 = 23,770원이고, 여기에 배송비 3,000원을 더한 26,770원의 1%가 268P다. 23,770원의 1%는 237P다.
- 테스트: `npm test` (`node --test`), 테스트는 `test/`에 있다.
- `src/gift/gift-points.js`가 `earnPoints`나 `src/orders/`를 공유하는지 fix에서 먼저 확인할 것.

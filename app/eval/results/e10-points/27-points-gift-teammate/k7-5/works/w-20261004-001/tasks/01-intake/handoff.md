---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "기대값 237P는 요청에 적힌 고객센터 계산 값을 그대로 기준으로 삼았다"
  - "다른 주문도 같은 방식으로 많게 나온다고 보고 일반 주문 적립 계산 전반을 범위로 잡았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "고객센터 계산의 정확한 규칙(적립 기준 금액)이 요청에 적혀 있지 않다. fix에서 237P가 나오는 기준을 확인해야 한다"
recommended_next: null
knowledge_candidates:
  - "이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 쓴다 (사람)"
  - "영수증 글자(src/format/)는 앱과 메일이 그대로 보여 주므로 바뀌면 안 된다 (사람)"
  - "선물하기 적립(src/gift/gift-points.js)은 다른 팀과 같이 보고 있어 손대지 않는다 (사람)"
---
## 요약
O-1042 적립이 268P로 나오는 버그의 의도를 정리했다. 기대값은 237P이다. 저장된 적립값, 영수증 글자, 선물하기 적립은 건드리지 않는다.
## 다음 task가 알아야 할 것
- 적립 계산: `src/points/earn.js`, 호출은 `src/orders/order.js`의 `createOrder`
- 테스트: `npm test` (현재 20개 통과)
- 참고(가설, 확인 안 됨): O-1042 입력으로 `amounts` 값을 보면 268P와 237P의 차이가 어느 금액에서 오는지 확인할 수 있다.
- 선물하기 적립이 `earnPoints`를 공유하는지 확인하고, 공유하면 gift 쪽 결과가 바뀌지 않게 주의한다.

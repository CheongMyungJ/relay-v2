---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "기대값 237P는 고객센터 계산 기준이며 요청에 적힌 값을 그대로 썼다. 계산식은 확인하지 않았다"
  - "다른 주문의 정답 값은 요청에 없어서 완료조건에 O-1042 외 구체 값은 넣지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "gift-points.js가 earn.js나 공통 함수를 공유하면 수정이 선물하기 적립에 영향을 줄 수 있다. 확인하지 않았다"
  - "저장된 적립 값과 새로 계산한 값이 섞이는 경로가 있는지 확인하지 않았다"
recommended_next: null
knowledge_candidates:
  - "이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 그대로 쓴다 (사람)"
  - "선물하기 적립(src/gift/gift-points.js)은 다른 팀과 함께 보는 중이라 포인트 관련 일에서도 손대지 않는다 (사람)"
---
## 요약
O-1042 적립 예정 포인트가 268P로 나오는 문제(기대 237P)를 고치는 bugfix 의도 초안을 썼다. 재계산 금지, 영수증 불변, 선물하기 적립 불변을 비목표로 두었다.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: `earnPoints`는 `percentOf(order.amounts.total, POINT_RATE_PERCENT)`를 돌려준다. 원인은 분석하지 않았다.
- `order.amounts.total`을 만드는 곳은 `src/orders/order.js`, `src/cart/`, `src/money.js`이며 확인하지 않았다.
- 테스트는 `npm test`(`node --test`), 기존 테스트는 `test/` 아래에 있다.
- 입력 예시: `examples/O-1042.json` (쿠폰 3000원, 사용 포인트 1500P, 상품 8900x2 + 3490x3).
- 팀 지식 항목은 없다.

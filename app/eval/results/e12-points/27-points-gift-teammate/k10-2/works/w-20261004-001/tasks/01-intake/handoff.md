---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "기대 결과는 요청에 적힌 O-1042 = 237P로 한다"
    why: "고객센터가 적립 안내대로 계산한 값이 요청에 명시됨"
    by: human
assumptions:
  - "다른 일반 주문도 같은 기준(적립 안내)으로 계산되어야 한다고 보았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(`src/gift/gift-points.js`)에 같은 계산이 있을 수 있으나 이번 범위에서 제외됨"
recommended_next: null
knowledge_candidates:
  - "이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값을 그대로 쓴다 (사람)"
  - "영수증 글자(`src/format/`)는 앱과 메일이 그대로 보여 주므로 바뀌면 안 된다 (사람)"
---
## 요약
일반 주문 적립 예정 포인트가 많게 나오는 버그의 의도를 정리했다. O-1042는 268P가 아니라 237P여야 한다. 저장된 적립 값, 영수증 글자, 선물하기 적립은 건드리지 않는다.
## 다음 task가 알아야 할 것
- 적립 계산: `src/points/earn.js`의 `earnPoints`, 호출은 `src/orders/order.js:35`.
- 선물하기 적립은 `src/gift/gift-points.js`에 따로 있고 `earnPoints`를 쓰지 않는다. 이번에는 수정 금지.
- 참고용 관찰(확인 안 됨): O-1042는 상품 28,270원, 쿠폰 3,000원, 배송비 3,000원, 포인트 사용 1,500원이다. 현재 268P는 배송비가 든 결제 금액 26,770원에서 나온 값과 맞고, 237P는 배송비를 뺀 23,770원의 1%와 맞는다.
- 테스트: `npm test`(`node --test`), 재현: `node src/cli.js examples/O-1042.json`.

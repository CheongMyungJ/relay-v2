---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "기대값은 요청에 적힌 고객센터 계산 237P로 둔다"
    why: "요청 원문이 O-1042의 올바른 값을 237P로 명시함"
    by: human
assumptions:
  - "다른 일반 주문도 O-1042와 같은 기준의 고객센터 계산을 따른다고 가정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "고객센터 계산 기준이 문서로 확인되지 않아 237P가 나오는 기준은 fix에서 확인해야 함"
recommended_next: null
knowledge_candidates:
  - "이미 적립된 포인트는 다시 계산하지 않고 주문에 저장된 값(points.earned)을 쓴다 (사람)"
---
## 요약
O-1042 적립 예정 포인트가 268P로 나오는데 237P여야 하는 버그의 의도를 정리했다. 선물하기 적립, 영수증 글자, 저장된 적립 값은 건드리지 않는다.
## 다음 task가 알아야 할 것
- 적립 계산: `src/points/earn.js:5`, 호출: `src/orders/order.js:35`
- 테스트 실행: `npm test` (`node --test`)
- 참고 숫자(가설 아님, 단순 산술): 현재 `amounts.total`은 26770이고 이것의 1%가 268P다. 237P는 23770의 1%다. 두 금액의 차이 3000이 무엇인지는 fix에서 확인한다.
- 기존 테스트: `test/order.test.js:26`은 적립 500을 기대한다.

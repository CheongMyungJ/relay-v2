---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "O-1042의 기대값은 고객센터 계산인 237P로 한다"
    why: "요청에 명시됨"
    by: human
assumptions:
  - "다른 주문도 같은 계산 규칙으로 고객센터 값과 맞아야 한다고 보았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "237P를 만드는 정확한 계산 규칙(할인, 쿠폰, 사용 포인트 반영 여부)을 확인하지 않았다"
recommended_next: null
knowledge_candidates:
  - "이미 적립된 포인트는 주문에 저장된 값을 그대로 쓰고 다시 계산하지 않는다 (사람)"
  - "영수증 글자(src/format/)는 바뀌면 안 된다 (사람)"
  - "선물하기 적립(src/gift/gift-points.js)은 다른 팀과 같이 보는 중이라 건드리지 않는다 (사람)"
---
## 요약
적립 예정 포인트가 많게 나오는 버그의 의도 초안을 썼다. 기대값은 O-1042가 237P이다. 선물하기 적립과 영수증 글자는 비목표로 두었다.
## 다음 task가 알아야 할 것
- 적립 계산: `src/points/earn.js`가 `order.amounts.total`에 `POINT_RATE_PERCENT`를 곱한다. `percentOf`는 `src/money.js`에 있다. 원인은 확인하지 않았다.
- 예시 주문: `examples/O-1042.json`.
- 테스트: `npm test`(`node --test`), 테스트는 `test/`에 있다.

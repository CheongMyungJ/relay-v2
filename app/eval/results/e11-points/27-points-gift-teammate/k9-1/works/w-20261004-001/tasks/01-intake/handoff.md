---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "비목표에 이미 적립된 포인트 재계산, 영수증 글자(src/format/), 선물하기 적립(src/gift/gift-points.js)을 넣는다"
    why: "요청 원문에서 사람이 명시한 범위 제한"
    by: human
assumptions:
  - "기대값 237P는 고객센터 계산을 기준으로 한다"
  - "테스트 명령은 package.json의 npm test (node --test)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "237P의 계산 기준이 요청에 적혀 있지 않아 fix에서 기준을 확인해야 한다"
recommended_next: null
knowledge_candidates: []
---
## 요약
O-1042의 적립 예정 포인트가 268P가 아니라 237P가 되도록 고치는 버그 수정 의도를 정리했다. 이미 적립된 값, 영수증 글자, 선물하기 적립은 비목표다.
## 다음 task가 알아야 할 것
- 의심 위치: `src/points/earn.js`의 `earnPoints`. 현재 `percentOf(order.amounts.total, POINT_RATE_PERCENT)`를 쓴다. 원인은 확인하지 않았다.
- 재현 입력: `examples/O-1042.json` (상품 17,800 + 10,470원, 쿠폰 3,000, 포인트 사용 1,500). 기대 237P, 현재 268P.
- 테스트: `npm test`. 관련 파일은 `test/`에 있다.
- 건드리지 말 것: `src/format/`, `src/gift/gift-points.js`.

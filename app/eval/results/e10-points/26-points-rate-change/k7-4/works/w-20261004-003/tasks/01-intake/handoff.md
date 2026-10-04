---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "업무 유형을 bugfix 그대로 진행한다"
    why: "O-1107이 현재 코드로는 2%에서도 547P가 나와 기대값 486P와 어긋나, 이 어긋남을 바로잡는 일이 포함된다"
    by: human
assumptions:
  - "O-1107의 기대값 486P는 배송비 제외 기준액(24,330원)의 2%를 버림한 값이다"
  - "선물하기 적립도 같은 적립률 상수를 쓰므로 2%가 적용되는 것이 맞다고 가정했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립(`src/gift/gift-points.js`)이 같은 상수를 써서 상수 변경 시 함께 2%가 된다"
  - "팀 지식 두 건은 기준 브랜치에 아직 없는 앞 Work(w-20261004-001, w-20261004-002)에서 왔다. 적립 기준액과 환불 회수 코드는 앞 Work가 이미 고쳤을 수 있고 머지 대기 중이다"
recommended_next: null
knowledge_candidates: []
---
## 요약
적립률을 2%로 올리고 O-1107이 486P가 되도록 하는 의도 초안을 썼다. 저장된 적립값과 영수증 글자는 건드리지 않는다.
## 다음 task가 알아야 할 것
- `src/config.js:9` `POINT_RATE_PERCENT = 1`, `src/points/earn.js`, `src/orders/refund.js:34`, `src/gift/gift-points.js`가 이 상수를 쓴다.
- 현재 `earnPoints`는 `amounts.total`(배송비 포함)에 `percentOf`(반올림, `src/money.js`)를 쓴다. O-1107은 total 27,330원이라 2%면 547P가 되어 기대값과 다르다(참고용 관찰, 원인 확정 아님).
- 참고 팀 지식: docs/knowledge/points-earn-basis-floor.md, docs/knowledge/partial-refund-points-recovery.md
- 테스트는 `npm test`(node --test).

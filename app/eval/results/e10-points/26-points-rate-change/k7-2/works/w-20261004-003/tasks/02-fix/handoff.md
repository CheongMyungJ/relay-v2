---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "일반 주문 전용 상수 ORDER_POINT_RATE_PERCENT=2를 추가하고 POINT_RATE_PERCENT(1)는 유지한다"
    why: "선물하기·부분 환불 회수가 같은 상수를 써서 비목표를 지켜야 한다 (docs/knowledge/points-earn-rule.md)"
    by: ai
  - what: "적립은 earn.js 안에서만 Math.floor로 버림하고 percentOf는 바꾸지 않는다"
    why: "팀 지식 points-earn-rule.md와 intent 제약"
    by: ai
assumptions: []
rejected:
  - "POINT_RATE_PERCENT를 2로 올림: 선물하기·환불 회수까지 바뀌어 비목표 위반"
open_questions: []
intent_deviation: null
risks:
  - "기존 테스트 변경: test/order.test.js '적립 포인트를 주문에 저장한다' 기대값 500 → 1000 (규정 변경 반영). 약화 여부는 verify가 판단"
  - "환불 회수는 1% 기준이라 2%로 적립된 새 주문을 부분 환불하면 회수 포인트가 맞지 않을 수 있음 (이번 범위 밖)"
  - "앞 Work(w-20261004-001)에서 earn.js를 고쳤을 수 있음, 머지 대기. 머지 시 충돌 가능"
recommended_next: null
knowledge_candidates:
  - "일반 주문 적립률은 ORDER_POINT_RATE_PERCENT(2%), 선물하기·환불 회수는 POINT_RATE_PERCENT(1%)로 상수가 분리돼 있다. 일반 주문 적립은 src/points/earn.js"
---
## 요약
일반 주문 적립을 (상품 − 쿠폰 − 사용 포인트)의 2% 버림으로 고쳤다. O-1107은 273P에서 486P가 된다. 선물·환불·format은 건드리지 않았고 `npm test` 21개가 통과한다.
## 다음 task가 알아야 할 것
- `src/config.js` `ORDER_POINT_RATE_PERCENT`, `src/points/earn.js:5` 적립 계산
- 재현: `node src/cli.js examples/O-1107.json | grep 적립` → 486P
- 기존 테스트 1건 기대값 변경 (test/order.test.js, 500 → 1000)
- 환불 회수 1% 불일치는 범위 밖 위험으로 남김

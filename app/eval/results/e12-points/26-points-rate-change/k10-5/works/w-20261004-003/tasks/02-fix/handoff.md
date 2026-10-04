---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준(배송비 제외, 버림)도 이 브랜치에서 함께 고쳤다"
    why: "O-1107 486P를 맞추려면 필요해서 물었고 사람이 함께 고치기를 골랐다"
    by: human
  - what: "환불 회수용 상수 REFUND_RECOVER_RATE_PERCENT = 1을 분리했다"
    why: "비목표: 환불 회수는 지금 동작 유지"
    by: ai
  - what: "적립 기준을 팀 지식 earn-basis.md의 규칙대로 구현했다"
    why: "docs/knowledge/points/earn-basis.md"
    by: ai
assumptions:
  - "선물하기 적립은 상수만 따라 2%가 되며 테스트 기대값 300 → 600으로 바꿨다"
rejected:
  - "상수만 2로 변경: 547P가 나오고 환불 회수도 2%로 바뀜"
open_questions: []
intent_deviation: null
risks:
  - "w-20261004-002도 earnPoints를 고쳤다면 머지 때 충돌할 수 있음(앞 Work에서 고쳤을 수 있음, 머지 대기)"
  - "기존 테스트 기대값 변경: order.test.js 500→1000, gift.test.js 300→600"
  - "w-002가 환불 회수를 재계산 방식으로 바꾸면 REFUND_RECOVER_RATE_PERCENT 사용처가 달라짐"
recommended_next: null
knowledge_candidates:
  - "환불 회수 비율은 REFUND_RECOVER_RATE_PERCENT(1)로 분리, 새 적립률 적용 여부는 정산팀과 따로 정함 (사람)"
  - "2026-10-04 기본 적립률 1%에서 2%로 올림 (사람)"
---
## 요약
적립률을 2%로 올리고 적립 기준을 배송비 제외·버림으로 맞춰 O-1107이 486P가 되게 했다. 환불 회수는 별도 상수 1%로 분리해 그대로다. `npm test` 22건 통과.
## 다음 task가 알아야 할 것
- `src/config.js`: `POINT_RATE_PERCENT = 2`, `REFUND_RECOVER_RATE_PERCENT = 1`
- `src/points/earn.js`: 새 기준, `src/money.js`: `floorPercentOf`
- 기존 테스트 기대값 2건 변경(order, gift)
- 확인: `node src/cli.js examples/O-1107.json` → 486P

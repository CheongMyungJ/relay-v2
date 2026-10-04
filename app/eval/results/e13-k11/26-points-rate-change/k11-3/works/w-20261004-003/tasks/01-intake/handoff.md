---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수의 새 비율 적용은 이번 범위에서 뺀다"
    why: "사람: 정산팀과 따로 정할 것이라 이번 범위가 아님"
    by: human
  - what: "업무 유형을 사람이 고른 bugfix 그대로 진행한다"
    why: "요청은 적립률 변경이라 유형이 어긋나 물었고, 사람이 bugfix 유지를 선택함"
    by: human
assumptions:
  - "O-1107의 486P는 팀 지식 규칙(배송비 제외, 버림)으로 계산한 값과 일치한다고 보았다"
  - "선물하기 적립은 새 적립률 대상이다(팀 지식: 일반 주문과 같은 earnPoints 기준)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "refund.js:34가 POINT_RATE_PERCENT를 공유한다. 값을 2로 올리면 환불 회수도 따라 바뀌므로 fix에서 환불 회수가 안 바뀌게 분리해야 한다"
  - "팀 지식 earn-basis.md는 앞 Work(w-20261004-001)에서 왔고 머지 대기다. 현재 코드가 규칙과 다른 부분은 그 Work가 고쳤을 수 있다. 머지 시 충돌 가능"
recommended_next: null
knowledge_candidates:
  - "정하지 않음: 부분 환불 때 회수 포인트에 새 적립률(2%)을 쓸지 — 사람이 \"이번 범위가 아니고 정산팀과 따로 정할 것\"이라고 함, 정산팀과 사람이 정함, 지금 코드는 refund.js가 POINT_RATE_PERCENT를 그대로 씀 (사람)"
---
## 요약
적립률 1%→2% 적용 요청을 bugfix 유형 그대로 의도 초안으로 정리했다. 기준은 팀 지식 규칙(배송비 제외, 버림)이고 저장된 값과 영수증은 건드리지 않는다.
## 다음 task가 알아야 할 것
- `src/config.js:9` `POINT_RATE_PERCENT = 1`. 쓰는 곳: `src/points/earn.js`, `src/gift/gift-points.js`, `src/orders/refund.js:34`
- 현재 코드(기준 커밋)는 `amounts.total`(배송비 포함)에 `percentOf`(`src/money.js`, 반올림)를 쓴다. O-1107은 total 27,330이라 2%면 547P가 나와 기대값 486P와 다르다. 팀 지식 규칙은 배송비 제외와 버림이다 (`docs/knowledge/points/earn-basis.md`, 참고)
- `npm test`는 `node --test`

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수의 새 비율 적용은 비목표로 뺀다"
    why: "정산팀과 따로 정하기로 함"
    by: human
  - what: "업무 유형을 사람이 고른 bugfix 그대로 진행한다"
    why: "요청은 적립률 변경이라 유형과 맞지 않아 물었고, 사람이 그대로 진행하겠다고 답함"
    by: human
assumptions:
  - "O-1107의 486P는 배송비 3,000원을 뺀 24,330원의 2%를 버림한 값이다. 팀 지식의 적립 규칙과 일치한다"
  - "선물하기 적립도 2%와 버림 기준을 따른다 (팀 지식 규칙)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식의 배송비 제외·버림 규칙은 앞 Work(w-20261004-001, 002)에서 왔다. 이 브랜치의 코드에는 아직 없어 앞 Work에서 고쳤을 수 있음, 머지 대기. 이 브랜치 earn.js는 배송비 포함 반올림이라 2%만 올리면 O-1107이 547P가 된다"
  - "refund.js는 POINT_RATE_PERCENT를 직접 쓰므로 config 값을 2로 바꾸면 환불 회수 계산도 함께 바뀐다. 사람이 환불 회수는 이번 범위가 아니라고 했으니 fix에서 환불 회수 결과가 달라지지 않게 해야 한다"
recommended_next: null
knowledge_candidates: []
---
## 요약
적립률을 1%에서 2%로 올리는 변경의 intent 초안을 썼다. O-1107이 486P가 되어야 한다는 것이 핵심 완료조건이다.
## 다음 task가 알아야 할 것
- `src/config.js:9` `POINT_RATE_PERCENT = 1`. 사용처는 `src/points/earn.js:6`, `src/gift/gift-points.js:6`, `src/orders/refund.js:34`.
- 현재 `earnPoints`는 `amounts.total`(배송비 포함)에 `percentOf`(`src/money.js`, 반올림)를 쓴다. O-1107은 total 27,330 → 2%면 547P, 규칙대로면 24,330 → 486P.
- 참고 지식: `docs/knowledge/points/earn-rule.md` (기준 브랜치에는 아직 없음).
- 테스트는 `npm test` (현재 20개 통과).

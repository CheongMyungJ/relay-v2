---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(저장된 points.earned 유지 테스트 추가)만 반영하고 2(주석 유지 제안)는 반영하지 않는다"
    why: "사람이 '1번만 반영'을 골랐다"
    by: human
assumptions: []
rejected:
  - "POINT_RATE_PERCENT 이름 변경: refund.js를 건드리게 되어 이번 범위 밖"
open_questions: []
intent_deviation:
  summary: "intent 원하는 결과는 부분 환불 회수의 재계산 적립도 2% 기준이라 했으나, 코드의 환불 회수는 1%로 남아 있다"
  evidence: "src/orders/refund.js:34가 POINT_RATE_PERCENT(1%) 사용. t-02에서 사람이 '환불 회수에 새 비율을 쓸지는 이번 범위가 아니고 정산팀과 따로 정한다'고 답함"
risks:
  - "2%로 적립된 주문을 부분 환불하면 회수가 적립의 절반 수준(src/orders/refund.js:34). 정산팀과 따로 정해야 한다"
  - "앞 Work(w-20261004-002)에서 고쳤을 수 있음, 머지 대기: 환불 회수 계산식. src/points/earn.js 머지 충돌 가능"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 1건(저장값 유지 테스트)을 반영해 커밋했다. 완료조건 6개 모두 통과, `npm test` 23개 통과, O-1107은 486P다. 바뀐 테스트 파일 3개는 모두 약화 아님.
고친 지식: docs/knowledge/points/earn-rule.md — 적립률 1% → 2%(`EARN_RATE_PERCENT`), 환불 회수 비율은 정산팀과 따로 정함(아직 정하지 않은 것에 추가). 기준 브랜치에 없던 앞 내용은 모두 살려 같은 경로에 씀.
## 다음 task가 알아야 할 것
- `src/config.js`: `EARN_RATE_PERCENT = 2`(적립), `POINT_RATE_PERCENT = 1`(refund.js 전용).
- `src/points/earn.js`: `earnBase`, `earnPoints`. 선물하기는 earnPoints 호출.
- `test/earn.test.js`: 재현 테스트와 저장값 유지 테스트.
- 환불 회수 새 비율은 정산팀 확인 후 `earn-rule.md`의 "아직 정하지 않은 것"에서 규칙으로 옮긴다.

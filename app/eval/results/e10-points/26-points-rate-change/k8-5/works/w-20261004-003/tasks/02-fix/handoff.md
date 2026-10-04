---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립률 상수는 2로 올리고, 환불 회수는 별도 상수 REFUND_RECOVER_RATE_PERCENT=1로 분리한다"
    why: "intent 비목표: 환불 회수 계산은 지금과 같게 둔다. refund.js가 POINT_RATE_PERCENT를 직접 썼음"
    by: ai
  - what: "적립과 선물 적립을 (total - shipping)의 율% 버림으로 바꾼다"
    why: "팀 지식 docs/knowledge/points/earn-rule.md 규칙, 완료조건 O-1107 → 486P"
    by: ai
assumptions:
  - "기존 테스트 2개(order 500→1000, gift 300→600)의 기대값 변경은 2% 적용에 따른 것으로 본다"
rejected:
  - "상수만 2로 변경: O-1107이 547P가 되고 환불 회수도 바뀐다"
open_questions: []
intent_deviation: null
risks:
  - "기존 테스트 2개의 기대값을 바꿨다 (test/order.test.js, test/gift.test.js). 약화 여부는 verify가 판단"
  - "팀 지식의 배송비 제외·버림 규칙은 앞 Work(w-20261004-001, 002)에서 고쳤을 수 있음, 머지 대기. 머지 시 earn.js, gift-points.js, refund.js, config.js에서 충돌 가능"
  - "환불 회수 비율은 정산팀 결정 전까지 1% 반올림 그대로. 결정되면 REFUND_RECOVER_RATE_PERCENT를 바꾼다"
recommended_next: null
knowledge_candidates:
  - "환불 회수 비율은 적립률과 분리된 `REFUND_RECOVER_RATE_PERCENT`(현재 1)를 쓴다. 새 비율 적용 여부는 정산팀과 따로 정한다 (사람)"
---
## 요약
적립률을 2%로 올리고 적립/선물 적립을 배송비 제외 버림으로 고쳤다. O-1107은 486P다. 환불 회수는 별도 상수로 분리해 기존 결과를 유지했다. `npm test` 23개 통과.
## 다음 task가 알아야 할 것
- `src/config.js`: `POINT_RATE_PERCENT = 2`, `REFUND_RECOVER_RATE_PERCENT = 1`
- `src/money.js`: `floorPercentOf` 추가. `earn.js`, `gift-points.js`가 사용
- 새 테스트 `test/earn.test.js`. 수정된 기존 테스트는 `test/order.test.js`, `test/gift.test.js`
- 확인: `npm test` (23 통과), `src/format/` 변경 없음

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "환불 회수 비율을 REFUND_RECOVER_RATE_PERCENT = 1로 분리한다"
    why: "intent 비목표: 환불 회수 계산은 이번에 바꾸지 않는다. 상수 공유 때문에 2로 바뀌는 것을 막는다"
    by: ai
  - what: "earnPoints를 배송비 제외 순 금액 버림으로 바꾸고 giftPoints는 earnPoints에 위임한다"
    why: "팀 지식 docs/knowledge/points/earn-basis.md와 O-1107 기대값 486"
    by: ai
  - what: "order/gift 테스트의 적립 기대값을 2배로 고친다"
    why: "적립률 2% 정책 반영. 검증 강도는 그대로"
    by: ai
assumptions:
  - "팀 지식 파일은 이 브랜치에 없어 intent 제약에 적힌 규칙을 따랐다"
rejected:
  - "값만 2로 변경: total 기준 반올림이라 547P로 기대값 486과 다름"
open_questions: []
intent_deviation: null
risks:
  - "기존 테스트 2건의 기대값 변경(order 500→1000, gift 300→600)"
  - "앞 Work(w-20261004-001)에서 earnPoints를 이미 고쳤을 수 있음, 머지 대기. 머지 시 earn.js 충돌 가능"
recommended_next: null
knowledge_candidates:
  - "정하지 않음: 부분 환불 회수에 새 적립률을 쓸지 — 사람이 \"이번 범위가 아니고 정산팀과 따로 정할 것\"이라고 함, 정산팀과 사람이 정함, 지금 코드는 REFUND_RECOVER_RATE_PERCENT=1을 씀 (사람)"
---
## 요약
적립률을 2%로 올리고 적립 계산을 배송비 제외 순 금액 버림으로 맞췄다. O-1107은 486P다. 환불 회수 비율은 별도 상수(1)로 분리해 결과가 그대로다. `npm test` 23개 통과.
## 다음 task가 알아야 할 것
- `src/config.js`: `POINT_RATE_PERCENT = 2`, `REFUND_RECOVER_RATE_PERCENT = 1`
- `src/points/earn.js`: 적립 계산, `src/gift/gift-points.js`는 위임
- 재현 테스트 `test/earn.test.js`, 기존 테스트 변경: `test/order.test.js`, `test/gift.test.js`

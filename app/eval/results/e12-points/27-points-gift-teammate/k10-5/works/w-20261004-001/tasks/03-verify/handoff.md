---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(환불 회수 반올림, 테스트 경계 보강)을 반영하지 않는다"
    why: "환불은 intent 범위 밖이고 규칙이 확정되지 않았으며, 테스트 보강은 사소하다"
    by: human
assumptions:
  - "적립 규칙은 O-1042 한 건에서 역산한 것이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/orders/refund.js:34 부분 환불 회수는 반올림이라 새 적립과 1P 어긋날 수 있다"
  - "src/gift/gift-points.js에는 같은 버그 식이 남아 있다 (범위에서 뺌)"
  - "O-1077, O-1107의 고객센터 값은 모른다 (수정 후 423P, 243P)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건은 사람이 반영하지 않기로 했다. 완료조건 5개 모두 통과했고, 재현 절차는 237P, `npm test`는 21개 통과다. 바뀐 테스트 파일은 test/order.test.js 하나이며 약화가 아니다.
새 지식: docs/knowledge/points/earn-points-basis.md — 적립 기준 규칙을 다루는 기존 항목이 없다
## 다음 task가 알아야 할 것
- 수정은 `src/points/earn.js`, 재현 테스트는 `test/order.test.js` 마지막 테스트.
- `src/gift/`, `src/format/`은 변경 없음.
- 환불 회수 `src/orders/refund.js:34`는 확인하지 않았다.

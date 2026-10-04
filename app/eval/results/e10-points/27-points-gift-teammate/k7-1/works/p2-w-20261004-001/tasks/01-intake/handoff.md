---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수(refund.js)는 이번 비목표로 둔다"
    why: "요청이 선물하기 적립만 고쳐 달라고 했고 환불은 언급하지 않음"
    by: ai
assumptions:
  - "G-0213 기준 금액은 24,860 − 2,000 − 1,000 = 21,860원이고 1%를 버리면 218P (코드 실행으로 확인하지 않고 손으로 계산)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 회수가 반올림 percentOf를 써서 선물 적립과 어긋날 수 있다. 이번 범위 밖이다"
recommended_next: null
knowledge_candidates: []
---
## 요약
선물하기 적립(249P)을 고객센터 기준(218P)으로 맞추는 버그 수정 의도 초안을 썼다. 질문 없이 초안을 먼저 썼다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: `percentOf(order.amounts.total, ...)` 반올림 사용. 총액에 배송비가 들어 있는지 fix에서 확인
- 팀 지식 참고: `docs/knowledge/earn-points-base-and-rounding.md`, `docs/knowledge/earn-points-rounding-mismatch-in-copies.md`
- 일반 주문 적립은 `src/points/earn.js`에 이미 수정되어 있으므로 같은 계산을 재사용할 수 있는지 볼 것
- 테스트 명령: `npm test` (`node --test`)

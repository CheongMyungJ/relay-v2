---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "사소 지적 1건(테스트 import 순서)을 반영하지 않는다"
    why: "사람이 반영하지 않음을 골랐다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/orders/refund.js:34 부분 환불 회수 포인트는 percentOf(반올림)로 적립 방식과 다를 수 있다. 이번 범위에서 뺌"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 1건(미반영). 완료조건 6개 모두 통과, `npm test` 24개 통과, G-0213 재현은 218P.
고친 지식: docs/knowledge/points/earn-base-and-rounding.md — 선물하기 적립도 earnPoints 규칙임을 적고, gift-points.js를 '아직 규칙을 따르지 않는 곳'에서 지움(이력 추가)
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`는 `earnPoints` 호출. 남은 불일치: `src/orders/refund.js:34`(지식 문서에 남김)
- 검증: `npm test`, G-0213 `points.earned`=218

---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "src/gift/gift-points.js를 이번 범위에 포함하고 팀 지식의 적립 규칙을 제약으로 옮긴다"
    why: "요청이 이 파일을 고치는 일이고, 지식의 '범위에서 뺌'은 그때 Work의 범위였다"
    by: ai
assumptions:
  - "G-0213에서 기대하는 값은 규칙대로 계산한 값(218P)이며 사람이 따로 준 숫자는 없다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식의 규칙은 O-1042 한 건에서 추론한 기준이다"
  - "지식에 다른 팀과 같이 보는 중이라 적혀 있어 gift-points.js 수정이 겹칠 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
G-0213 적립 포인트를 일반 주문 규칙(배송비 제외, 1% 내림)에 맞추는 bugfix 의도 초안을 썼다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: `percentOf(order.amounts.total, POINT_RATE_PERCENT)` 한 줄로 계산한다. 원인 확인은 fix에서 한다.
- 참고 지식: `docs/knowledge/points/earn-rule.md`, 일반 주문 계산은 `src/points/earn.js`
- 테스트: `npm test` (node --test), 선물 관련 `test/gift.test.js`
- 예제: `examples/G-0213.json`. 확인함(읽기만, 코드 변경 없음): amounts는 goods 24,860, coupon 2,000, shipping 3,000, total 24,860. 지금 249P(total 반올림), 규칙 `earnPoints` 적용 시 218P(floor(21,860×1%))

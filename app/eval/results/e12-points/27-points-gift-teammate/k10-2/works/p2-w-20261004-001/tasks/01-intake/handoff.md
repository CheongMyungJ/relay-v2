---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "선물하기 적립에 일반 주문 규칙(배송비 제외, 1%, 버림)을 적용한다"
    why: "팀 지식 earn-points-rule.md의 규칙이며 요청의 기대값 218P와 일치"
    by: ai
assumptions:
  - "G-0213의 배송비는 3,000원이고 결제 금액은 24,860원으로 추정한다. 249P와 218P가 모두 이 값으로 설명된다"
  - "팀 지식에 '범위에서 뺌, 다른 팀과 함께 보는 중'이라 적힌 gift-points.js를 이번 요청이 직접 고치라고 했으므로 범위에 넣는다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "gift-points.js를 다른 팀과 함께 보는 중이라고 지식에 적혀 있어 변경이 겹칠 수 있다"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/points/earn-points-rule.md — 선물하기 적립(src/gift/gift-points.js)도 같은 규칙을 따라야 한다. 이번 요청이 직접 수정을 요청함 (사람)"
---
## 요약
선물하기 적립 포인트를 일반 주문 규칙으로 맞추는 버그 수정 intent를 썼다. 질문은 없었다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js:5`: `percentOf(order.amounts.total, ...)`로 배송비 포함 반올림 중
- 기준 구현: `src/points/earn.js`의 `earnPoints`. 테스트는 `npm test`(node --test), `test/gift.test.js`
- 참고 지식: `docs/knowledge/points/earn-points-rule.md`, `stored-earned-points.md`, `format/receipt-text.md`

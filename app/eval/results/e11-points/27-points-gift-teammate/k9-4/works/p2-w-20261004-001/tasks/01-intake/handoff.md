---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "선물하기 주문 적립 포인트에 일반 주문과 같은 규칙(배송비 제외, 원 단위 버림)을 적용한다"
    why: "요청의 기대값 218P와 팀 지식 earn-points-rule.md가 같은 규칙이다"
    by: ai
assumptions:
  - "G-0213의 total은 24,860, 배송비는 3,000으로 계산된다고 보았다 (코드를 돌려 확인하지 않음). 그러면 (24,860−3,000)×1% = 218.6, 버림하면 218P"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식의 '아직 규칙을 따르지 않는 곳'에 gift-points.js가 있고 이전 Work에서 범위 밖이었다. 이번 요청은 바로 그 코드를 고치는 일이라 규칙대로 고치는 것으로 정리했다"
recommended_next: null
knowledge_candidates: []
---
## 요약
선물하기 주문 적립 포인트를 일반 주문과 같은 규칙으로 맞추는 버그 수정 intent를 썼다. 기대값은 G-0213이 218P다. 메시지 카드, 받는 사람, 영수증, 이미 저장된 적립 포인트는 바꾸지 않는다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js:5`: 선물 적립 계산. 배송비를 포함한 total에 `percentOf`를 쓴다 (참고, 원인 확정 아님).
- `src/points/earn.js`: 일반 주문의 `earnPoints`. 같은 규칙의 기존 구현.
- `src/gift/gift-order.js:36`: `giftPoints(order)` 호출 지점.
- 팀 지식 참고: `docs/knowledge/points/earn-points-rule.md`
- 테스트: `npm test` (`node --test`), 선물 관련은 `test/gift.test.js`. 현재 테스트는 배송비 0인 주문만 다룬다.

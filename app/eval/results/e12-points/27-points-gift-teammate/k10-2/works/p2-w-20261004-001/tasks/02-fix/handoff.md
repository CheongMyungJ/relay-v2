---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "giftPoints가 earnPoints를 재사용한다"
    why: "docs/knowledge/points/earn-points-rule.md: 일반 주문과 같은 규칙. 규칙을 한 곳에 둔다"
    by: ai
assumptions:
  - "선물 주문의 amounts.shipping은 일반 주문과 같은 orderAmounts로 계산된 값을 쓴다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "gift-points.js를 다른 팀과 함께 보는 중이라 변경이 겹칠 수 있다"
  - "이미 저장된 선물 주문의 points.earned는 다시 계산하지 않았다"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/points/earn-points-rule.md — 선물하기 적립(src/gift/gift-points.js)도 earnPoints를 쓰므로 '아직 규칙을 따르지 않는 곳'에서 뺀다 (사람)"
---
## 요약
선물하기 적립 포인트가 배송비를 포함해 반올림하던 것을 `earnPoints`로 바꿨다. G-0213은 249P에서 218P가 되었다. `npm test` 24개가 통과한다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: `earnPoints` 호출 한 줄
- 테스트: `test/gift.test.js`에 G-0213(218P)과 배송비 0원 버림(350P) 추가
- 수정 전 새 테스트 2개 실패, 수정 후 전체 통과 (`npm test`)
- `src/format/`, `percentOf`, `refund.js`는 건드리지 않았다

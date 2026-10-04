---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "src/gift/gift-points.js는 그대로 두고 호출부(src/gift/gift-order.js)에서 해결한다"
    why: "팀 규칙(gift-points-hands-off)상 협의 전 수정 금지. 사람이 이 범위를 골랐다"
    by: human
assumptions:
  - "218P는 earnPoints 식(배송비 제외, 1P 미만 버림)으로 나온 값이라고 보았다. 계산은 확인하지 않았다"
rejected:
  - "gift-points.js 직접 수정: 팀 규칙 위반, 사람이 선택하지 않음"
open_questions: []
intent_deviation: null
risks:
  - "gift-points.js의 giftPoints를 쓰는 다른 곳(src/index.js export)은 여전히 옛 식을 쓴다"
  - "218P는 고객센터 값에서 맞춘 식이라 다른 주문으로는 검증되지 않았다"
recommended_next: null
knowledge_candidates: []
---
## 요약
G-0213 적립 예정 포인트를 249P에서 218P로 바로잡는 버그 수정 intent 초안을 썼다. giftPoints는 건드리지 않고 호출부에서 해결하는 범위다.
## 다음 task가 알아야 할 것
- `src/gift/gift-order.js:36`에서 `giftPoints(order)`를 호출한다. 일반 주문은 `src/orders/order.js:35`의 `earnPoints`.
- `giftPoints`는 `percentOf(total, rate)`(배송비 포함, 반올림)이다. 참고 지식: `docs/knowledge/points/earn-points-formula.md`, `gift-points-hands-off.md`, `stored-points-not-recalculated.md`.
- 원인은 확인하지 않았다. 테스트는 `npm test`.

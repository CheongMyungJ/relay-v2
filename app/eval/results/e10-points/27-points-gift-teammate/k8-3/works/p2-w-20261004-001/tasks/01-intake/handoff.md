---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "src/gift/gift-points.js를 수정하지 않고, 그 밖에서 해결 방법을 찾는다"
    why: "요청은 이 파일 수정을 말하지만 팀 규칙은 수정 금지. 사람이 금지 유지를 택함"
    by: human
assumptions:
  - "G-0213의 기대값은 일반 주문과 같은 규칙(배송비 제외, 1P 미만 버림)의 값이다"
rejected:
  - "gift-points.js 직접 수정: 팀 규칙으로 금지, 사람이 유지 확인"
open_questions: []
intent_deviation: null
risks:
  - "gift-points.js와 percentOf를 못 건드리므로 호출 쪽에서 우회가 필요할 수 있고, 불가능하면 fix에서 blocked가 될 수 있다"
recommended_next: null
knowledge_candidates:
  - "선물하기 적립 수정 요청이 와도 gift-points.js는 이번에도 수정 금지로 유지하기로 했다 (사람)"
---
## 요약
G-0213 선물 적립 예정 포인트(249P)를 일반 주문 규칙으로 맞추는 버그 수정 의도를 정리했다. gift-points.js 수정 금지는 사람이 유지하기로 했다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: `percentOf(order.amounts.total, ...)`, 배송비 포함 반올림. 수정 금지.
- `src/points/earn.js`: 기준 구현(배송비 제외, `Math.floor`).
- 테스트: `npm test` (`node --test`).
- 참고 지식: `docs/knowledge/points/earn-base-and-rounding.md`, `docs/knowledge/gift/gift-points-hands-off.md`
- giftPoints를 부르는 곳을 fix에서 찾아, 파일 밖에서 바로잡을 수 있는지 먼저 확인할 것.

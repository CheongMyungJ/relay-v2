---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "giftPoints를 earnPoints에 위임해 일반 주문과 같은 기준을 쓴다"
    why: "팀 지식 docs/knowledge/points/earn-basis.md: 배송비 제외, 버림, 이미 적립된 값 재사용"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "refund.js:34의 환불 회수 포인트는 여전히 반올림 기준이다(요청 범위 밖)"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/points/earn-basis.md — src/gift/gift-points.js는 이제 earnPoints에 위임해 규칙을 따른다. '아직 규칙을 따르지 않는 곳'에서 뺀다"
---
## 요약
선물하기 적립이 배송비 포함 금액을 반올림하던 것을 `earnPoints`에 위임하게 고쳤다. G-0213은 249P에서 218P가 됐다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: `earnPoints` 위임
- 테스트: `test/gift-points.test.js`, `npm test` 27개 통과
- 확인: `node src/cli.js examples/G-0213.json`에서 적립 예정 218P
- 남은 것: `src/orders/refund.js:34` 반올림(범위 밖)

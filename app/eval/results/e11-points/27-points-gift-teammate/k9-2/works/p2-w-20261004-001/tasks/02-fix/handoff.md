---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "giftPoints를 earnPoints에 위임해 규칙을 한 곳에서 쓴다"
    why: "docs/knowledge/points/earn-rule.md의 적립 규칙을 따르고, 두 곳이 어긋나는 일을 막는다"
    by: ai
assumptions:
  - "G-0213의 기대값 218P는 규칙에서 계산한 값이며 사람이 따로 준 숫자는 아니다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "규칙은 O-1042 한 건에서 추론한 기준이다"
  - "src/gift/gift-points.js는 다른 팀과 같이 보는 중이라 수정이 겹칠 수 있다"
  - "src/orders/refund.js:34 환불 회수 포인트는 비목표라 건드리지 않았다"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/points/earn-rule.md — src/gift/gift-points.js는 이제 earnPoints를 쓰므로 '아직 규칙을 따르지 않는 곳'에서 뺀다"
---
## 요약
`giftPoints`가 총액을 반올림하던 것을 `earnPoints` 위임으로 바꿔 G-0213이 249P에서 218P가 되었다. 재현 테스트를 추가했고 `npm test`는 24개 모두 통과한다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: `earnPoints(order)` 호출로 변경
- `test/gift.test.js`: G-0213 218P 테스트 추가(기존 테스트 변경 없음)
- `src/orders/refund.js:34`는 그대로다(비목표)

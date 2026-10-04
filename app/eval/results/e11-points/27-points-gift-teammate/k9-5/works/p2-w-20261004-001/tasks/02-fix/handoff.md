---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "`giftPoints`가 `earnPoints`를 그대로 부르게 고친다"
    why: "팀 지식 docs/knowledge/points/earn-basis.md의 규칙(배송비 제외, 원 단위 미만 버림)을 따르고, 일반 주문과 같은 기준을 한곳에서 쓰기 위해서다. 지식 항목에서 gift-points.js는 고칠 대상이다."
    by: ai
assumptions:
  - "기대값 218P와 earn-basis 규칙은 고객센터 값 두 건(O-1042, G-0213)으로 확인됐다. 다른 주문으로는 확인하지 못했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/orders/refund.js의 pointsRecovered는 적립 기준과 다를 수 있으나 비목표라 손대지 않았다"
recommended_next: null
knowledge_candidates:
  - "src/gift/gift-points.js는 이제 earnPoints를 쓴다. earn-basis.md의 '아직 규칙을 따르지 않는 곳'에서 이 항목을 뺀다"
  - "아직 규칙을 따르지 않음: src/orders/refund.js — pointsRecovered가 percentOf(상품 금액) 반올림이다. 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
선물하기 주문의 적립 포인트가 일반 주문과 다르게 계산되던 버그를 고쳤다. `giftPoints`가 total 기준 반올림을 쓰던 것을 `earnPoints`로 바꿨다. G-0213은 249P에서 218P가 됐고, `npm test`는 27건 모두 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/gift/gift-points.js`. 이제 `earnPoints`(`src/points/earn.js`)를 부른다.
- 추가 테스트: `test/gift.test.js` 2건(G-0213 = 218P, 같은 입력의 일반 주문과 같은 값). 수정 전에는 249로 실패했다.
- 기존 테스트는 바꾸지 않았다.
- `src/format/`, 메시지 카드, 받는 사람 코드는 바꾸지 않았다.
- 환불 회수 포인트(`src/orders/refund.js`)는 그대로다.

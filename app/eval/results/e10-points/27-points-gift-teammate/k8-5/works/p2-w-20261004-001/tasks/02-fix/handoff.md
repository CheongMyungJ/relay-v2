---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "호출부 gift-order.js에서 earnPoints를 쓰도록 바꾼다"
    why: "intent의 범위와 팀 규칙 docs/knowledge/points/gift-points-hands-off.md, earn-points-formula.md"
    by: ai
assumptions:
  - "218P는 earnPoints 식으로 맞춘 고객센터 값이라 다른 주문으로는 검증되지 않았다"
rejected:
  - "금액(amounts) 계산 차이: 선물 주문도 orderAmounts를 그대로 쓴다"
open_questions: []
intent_deviation: null
risks:
  - "giftPoints는 src/index.js에서 여전히 export되며 옛 식이다. 협의 후 정리 필요"
  - "이미 옛 식으로 저장된 선물 주문의 points.earned는 다시 계산하지 않았다"
recommended_next: null
knowledge_candidates:
  - "선물 주문의 적립은 gift-order.js에서 earnPoints를 호출한다. giftPoints는 더 이상 주문 생성에 쓰이지 않지만 협의 전까지 남겨 둔다"
---
## 요약
G-0213이 249P로 나온 것은 선물 주문이 옛 식 giftPoints(배송비 포함, 반올림)를 썼기 때문이다. gift-order.js가 earnPoints를 쓰게 해 218P가 나온다. 재현 테스트를 추가했고 npm test 25개가 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/gift/gift-order.js:36`. `src/gift/gift-points.js`는 변경 없음.
- 테스트: `test/gift.test.js` 마지막 케이스, `npm test`.

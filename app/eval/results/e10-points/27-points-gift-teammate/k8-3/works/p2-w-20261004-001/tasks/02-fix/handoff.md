---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "gift-order.js에서 giftPoints 대신 earnPoints를 호출해 고친다"
    why: "docs/knowledge/gift/gift-points-hands-off.md: gift-points.js와 percentOf는 수정 금지, 일반 주문 적립은 earn.js에서만 계산"
    by: ai
assumptions:
  - "G-0213의 기대값 218P는 일반 주문과 같은 규칙의 값이다(고객센터 값으로는 확인하지 못함)"
rejected:
  - "gift-points.js 직접 수정: 팀 규칙으로 금지, 사람이 유지 확인"
  - "percentOf 변경: 공용 함수이고 수정 금지"
open_questions: []
intent_deviation: null
risks:
  - "giftPoints는 src/index.js에서 여전히 export되고 호출처가 없어진다. 외부에서 쓰면 옛 기준 값이 나온다"
  - "환불 회수 포인트(refund.js)는 범위 밖이라 선물 주문 적립(버림)과 1P 어긋날 수 있다"
recommended_next: null
knowledge_candidates:
  - "선물하기 주문의 적립은 gift-order.js에서 earnPoints로 계산한다. gift-points.js의 giftPoints는 더 이상 쓰이지 않지만 수정 금지다"
---
## 요약
선물 주문 G-0213의 적립이 249P였던 원인은 `createGiftOrder`가 배송비 포함 반올림인 `giftPoints`를 쓴 것이었다. `earnPoints`를 쓰도록 바꿔 218P가 된다. 재현 테스트를 추가했고 `npm test`는 24개 모두 통과한다.
## 다음 task가 알아야 할 것
- `src/gift/gift-order.js:36`: `earnPoints(order)` 호출로 변경
- `test/gift.test.js` 끝: G-0213 재현 테스트(218P)
- `src/gift/gift-points.js`, `src/money.js`, `src/format/`은 변경 없음
- 테스트: `npm test`

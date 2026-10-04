---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "giftPoints가 earnPoints를 호출하게 한다"
    why: "intent 목표: 일반 주문과 같은 기준. 기준을 한 곳에서 유지하고 팀 지식 earn-points-rule.md를 따른다(docs/knowledge/earn-points-rule.md)"
    by: ai
assumptions:
  - "선물하기도 일반 주문과 같은 기준을 쓴다는 근거는 고객센터 218P 한 건이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "다른 팀과의 협의 여부는 확인되지 않은 채 사람이 gift-points.js 수정을 허용했다"
  - "부분 환불 회수(refund.js)는 여전히 반올림이라 선물하기 주문 환불 시 적립과 회수 기준이 어긋날 수 있다(비목표라 건드리지 않음)"
recommended_next: null
knowledge_candidates:
  - "선물하기 적립(src/gift/gift-points.js)은 이제 earnPoints를 호출해 일반 주문과 같은 기준이다. 사람이 수정을 허용했고 다른 팀과의 협의 여부는 확인되지 않았다 (사람)"
  - "배송비가 있는 주문에서만 적립 기준 차이(total vs 상품-쿠폰-포인트)가 드러난다. 무료 배송 테스트로는 놓치기 쉽다"
---
## 요약
선물하기 적립이 배송비 포함 결제 금액을 반올림하던 것을 일반 주문과 같은 `earnPoints`로 바꿔 G-0213이 218P로 나온다. 재현 테스트를 추가했고 `npm test` 25개 통과.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: `earnPoints(order)` 호출로 변경
- `test/gift.test.js`: G-0213 = 218P 테스트 추가
- `node src/cli.js examples/G-0213.json` 수정 전후 차이는 적립 예정 줄(249P → 218P)뿐
- 이미 만들어진 주문의 `order.points.earned` 재계산 코드는 추가하지 않음

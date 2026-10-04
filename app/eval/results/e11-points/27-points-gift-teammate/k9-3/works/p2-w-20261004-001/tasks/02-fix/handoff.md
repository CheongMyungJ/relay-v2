---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "giftPoints가 earnPoints를 그대로 호출하도록 했다"
    why: "팀 지식 docs/knowledge/points/earn-base-and-rounding.md: 일반 주문 적립은 배송비를 뺀 금액의 1% 버림이고, gift-points.js는 아직 규칙을 따르지 않는 곳으로 적혀 있다. 의도의 '같은 방식으로 계산'과도 맞는다"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/orders/refund.js:34의 부분 환불 회수 포인트는 여전히 percentOf(반올림)라 적립 방식과 다를 수 있다. 이번에 손대지 않았다"
recommended_next: null
knowledge_candidates:
  - "선물하기 적립 포인트(src/gift/gift-points.js)는 earnPoints를 쓴다. 일반 주문과 같은 기준(배송비 제외, 원 미만 버림)이다. G-0213은 218P"
  - "아직 규칙을 따르지 않음: src/orders/refund.js:34 — 부분 환불 회수 포인트가 percentOf(반올림), 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
G-0213 적립이 249P로 나오던 것을 218P로 고쳤다. 선물하기 적립이 배송비를 포함해 반올림하던 것을 일반 주문의 `earnPoints`로 맞췄다. `npm test` 24개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/gift/gift-points.js` (`earnPoints` 호출)
- 테스트: `test/gift.test.js`에 G-0213 218P, 일반 주문과 동일 값 테스트 추가
- G-0213 계산: 상품 24,860 − 쿠폰 2,000 → 배송비 3,000, total 24,860, 적립 기준 21,860 → 218.6 → 218
- 기준 커밋에서 실패하던 기존 테스트는 없음. 저장된 `points.earned` 재계산 코드는 바꾸지 않음

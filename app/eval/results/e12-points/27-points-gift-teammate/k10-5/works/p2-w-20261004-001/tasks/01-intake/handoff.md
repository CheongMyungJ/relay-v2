---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "선물하기 적립에도 일반 주문과 같은 적립 기준(상품−쿠폰−사용 포인트, 1% 내림)을 적용한다"
    why: "팀 지식의 규칙이 선물하기 적립에도 그대로 통하고, G-0213 계산이 218P로 고객센터 값과 맞는다"
    by: ai
assumptions:
  - "선물하기 주문의 order.amounts에도 goods, coupon, pointsUsed가 있다고 가정함 (확인 안 함)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/orders/refund.js:34 부분 환불 회수는 반올림이라 새 기준과 1P 어긋날 수 있음. 이번 범위 밖"
recommended_next: null
knowledge_candidates: []
---
## 요약
선물하기 적립 포인트를 일반 적립과 같은 기준으로 맞추는 버그 수정 intent 초안을 썼다. 비목표는 메시지 카드, 받는 사람 정보, 영수증 글자, 이미 적립된 포인트, 환불 회수다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: 지금은 `percentOf(order.amounts.total, ...)`로 반올림한다. 결제 금액 기준이다.
- `src/points/earn.js`의 `earnPoints`가 기준 구현이다.
- G-0213 손계산: 15,900 + 4,480×2 = 24,860, 쿠폰 2,000, 포인트 1,000 → 21,860 → 218P.
- 참고 지식: `docs/knowledge/points/earn-points-basis.md`
- 테스트: `npm test` (node --test)

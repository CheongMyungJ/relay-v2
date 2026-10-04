---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "선물하기 적립 기준을 일반 주문과 같게(배송비 제외, 1P 버림) 맞추는 것을 목표로 한다"
    why: "요청: 고객센터 218P, 일반 주문과 같아야 한다는 문의. 24,860-2,000-1,000=21,860원의 1%를 버리면 218P"
    by: ai
assumptions:
  - "고객센터의 218P는 일반 주문과 같은 기준(상품-쿠폰-사용 포인트, 1% 버림)으로 계산한 값이다. 21,860원의 1%가 218.6이라 버림으로 맞는다"
rejected: []
open_questions:
  - "선물하기 적립 코드(src/gift/gift-points.js)를 바꾸는 것에 대해 다른 팀과 합의가 됐는가? 사람도 모르고 휴가 중인 동료에게 물을 수 없다. git 이력에도 근거가 없다"
intent_deviation: null
risks:
  - "다른 팀과 합의 없이 gift-points.js를 바꾸면 팀 지식 규칙을 어길 수 있다"
  - "선물하기 적립 기준을 배송비 제외로 바꾸는 것이 다른 팀의 의도와 다를 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
G-0213이 249P(배송비 포함 금액 반올림)로 나오는 문제를 일반 주문과 같은 기준으로 맞춰 218P가 되게 하는 의도 초안을 썼다. 선물하기 적립 코드는 다른 팀과 같이 보는 것이라, 수정 여부와 합의 확인을 open_questions에 남겼다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js:5`: `percentOf(order.amounts.total, POINT_RATE_PERCENT)`로 배송비 포함 총액을 반올림한다. (참고용 가설이며 원인으로 확정되지 않음)
- `src/points/earn.js`: 일반 주문 기준 `earnPoints`. 13ac8af에서만 고쳐졌고 gift 쪽 이력은 init 이후 없다.
- `examples/G-0213.json`: 상품 24,860, 쿠폰 2,000, 사용 포인트 1,000.
- 참고 지식: `docs/knowledge/earn-points-basis-excludes-shipping.md`, `docs/knowledge/gift-points-shared-with-other-team.md`, `docs/knowledge/saved-earned-points-never-recalculated.md`
- 테스트: `npm test`. `test/gift.test.js`는 배송비 없는 경우만 확인한다.

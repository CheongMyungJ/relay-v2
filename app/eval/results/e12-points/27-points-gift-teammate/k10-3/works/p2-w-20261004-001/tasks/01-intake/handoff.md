---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "G-0213의 목표 적립 포인트를 218P(고객센터 계산 기준)로 둔다"
    why: "사람이 고객센터 계산으로 218P여야 한다고 알려 줌. 선물하기에 일반 주문 기준을 적용할지 팀 지식이 미정이라 물었고, 사람이 이 값으로 확인하라고 답함"
    by: human
assumptions:
  - "선물하기 적립도 일반 주문과 같은 기준(배송비 제외 결제 금액의 1%, 1P 미만 버림)을 따른다고 가정함. 사람이 규칙은 정확히 모른다고 했고 218P라는 값만 줌"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "사람은 규칙을 정확히 모름. 218P가 이 기준으로 나오는 것은 확인했으나, 다른 선물하기 주문(배송비 무료 등)에서 고객센터 값과 같은지는 확인하지 못함"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/points/earn-basis.md — 고객센터 계산 기준으로 선물하기 G-0213의 적립은 218P이며 일반 주문과 같은 기준이다. fix에서 코드로 확인되면 반영 (사람)"
---
## 요약
선물하기 G-0213의 적립 예정 포인트를 일반 주문과 같은 기준으로 맞춰 218P가 나오게 하는 의도 초안을 썼다. 규칙은 사람이 정확히 모르고 218P 값만 줬다. 이 값은 아래 계산으로 확인했다.
## 다음 task가 알아야 할 것
- 참고(확인한 계산, 원인 단정 아님): G-0213 상품 24,860 − 쿠폰 2,000 = 22,860, 배송비 3,000, 사용 포인트 1,000이라 `amounts.total` = 24,860. 배송비를 뺀 21,860의 1%는 218.6이고 버리면 218P다. `total` 전체의 1%를 반올림하면 249P다.
- `src/gift/gift-points.js:6`은 `percentOf(order.amounts.total, ...)`(반올림, `src/money.js`)이고, 일반 주문은 `src/points/earn.js`의 `earnPoints`다.
- `test/gift.test.js`는 배송비 0인 주문의 300P만 확인한다. 실행은 `npm test`다.
- 참고 지식: `docs/knowledge/points/earn-basis.md`

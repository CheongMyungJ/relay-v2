---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "이번 Work에서 src/gift/gift-points.js 수정을 허용한다. 다른 파일은 건드리지 않는다"
    why: "팀 지식은 손대지 말라고 하지만, 사람이 이 일을 gift-points.js 수정으로 맡았다고 명시적으로 허용함"
    by: human
  - what: "적립 기준은 일반 주문 코드(earn.js)를 따른다. G-0213은 218P"
    why: "사람이 적립 규칙을 자세히 모르고, 동료가 고객센터와 맞춘 일반 주문 코드를 기준으로 하라고 함"
    by: human
assumptions:
  - "다른 팀과의 합의 여부는 확인되지 않았다. 사람의 허용을 따라 진행한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기 적립은 다른 팀이 같이 보는 중이라 이번 변경이 그 팀의 작업과 충돌할 수 있다"
  - "환불 회수(refund.js)는 반올림이라 선물 주문 환불 시 1P 어긋날 수 있다. 이번 범위 밖이다"
recommended_next: null
knowledge_candidates:
  - "선물하기 적립 계산(src/gift/gift-points.js)을 일반 주문 기준(배송비 제외, 원 단위 버림)으로 맞추는 것은 사람이 이번 Work에서 허용했다. 다른 팀과의 합의 여부는 사람도 모른다 (사람)"
---
## 요약
G-0213의 적립을 일반 주문과 같은 기준으로 맞추는 버그 수정 intent를 작성했다. 범위는 gift-points.js 안으로 한정했고, 사람이 수정을 허용했다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js:5`: `percentOf(order.amounts.total, ...)`로 배송비를 포함하고 반올림한다.
- `src/points/earn.js:5`: 일반 주문 기준은 `floor((total - shipping) * 비율 / 100)`이다.
- G-0213: 상품 24,860 − 쿠폰 2,000 − 포인트 1,000 = 21,860원. 1%는 218P. 배송비를 포함하면 249P다.
- `percentOf`는 refund.js와 공유하므로 건드리지 않는다.
- 참고 팀 지식: docs/knowledge/regular-order-points-rule.md
- 테스트: `npm test`, 선물 테스트는 test/gift.test.js

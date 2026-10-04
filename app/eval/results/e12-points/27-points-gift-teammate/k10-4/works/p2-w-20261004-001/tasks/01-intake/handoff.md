---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "선물하기 적립에 일반 주문 적립 규칙(상품금액 − 쿠폰 − 사용 포인트, 배송비 제외, 소수점 버림)을 적용한다"
    why: "사람 답: 일반 주문과 같은 규칙으로 하고 G-0213이 218P인지 확인해 달라고 함"
    by: human
  - what: "비목표는 기적립 포인트 재계산, 메시지 카드·받는 사람 정보, src/format/ 변경 없음"
    why: "요청 원문 그대로, 사람이 확인함"
    by: human
assumptions:
  - "218P는 24,860 − 2,000 − 1,000 = 21,860원의 1%(218.6)에서 소수점을 버린 값과 같다고 암산으로 확인함. 코드로 돌려 보지는 않음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "선물하기에 적용할지는 팀 지식상 다른 팀과 같이 정할 사항인데 합의가 확인되지 않았다. 사람은 이번 Work에서 적용하라고 함"
  - "사람이 규칙을 자세히 모른다. 일반 주문 규칙은 휴가 중인 동료가 고객센터와 맞춘 것"
recommended_next: null
knowledge_candidates:
  - "고객센터 계산으로 선물하기 주문 G-0213의 적립 포인트는 218P여야 한다 (사람)"
---
## 요약
선물하기 적립이 일반 주문과 같은 규칙을 쓰게 하는 버그 수정 의도 초안을 썼다. 사람이 일반 주문 규칙 적용을 정했고, G-0213은 218P가 나와야 한다.
## 다음 task가 알아야 할 것
- `src/gift/gift-points.js`: `percentOf(order.amounts.total, POINT_RATE_PERCENT)`로 배송비 포함 total 기준 반올림이다.
- 일반 주문은 `src/points/earn.js`의 `earnPoints`다. 이 규칙을 재사용할 수 있는지 fix에서 본다.
- 참고 팀 지식: `docs/knowledge/points/earn-rule.md`
- G-0213: 상품 15,900 + 4,480×2 = 24,860원, 쿠폰 2,000원, 사용 포인트 1,000원. 기대값 218P.
- 테스트: `npm test`

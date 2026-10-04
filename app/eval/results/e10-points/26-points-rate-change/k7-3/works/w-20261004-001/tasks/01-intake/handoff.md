---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "선물하기 적립과 환불 포인트 회수는 이번 범위에서 뺀다"
    why: "요청이 O-1042와 src/points/earn.js만 언급함"
    by: ai
assumptions:
  - "고객센터 237P는 O-1042 기준의 올바른 값이다(요청의 말 그대로)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/gift/gift-points.js는 earn.js와 같은 식이라 같은 문제가 있을 수 있다. 이번엔 범위 밖으로 둠"
  - "적립 안내의 정확한 기준 문서가 레포에 없을 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
O-1042의 적립 예정 포인트를 268P에서 237P로 바로잡는 버그 수정 intent를 썼다. 저장된 적립값 재계산 금지와 영수증 글자 불변을 제약으로 넣었다.
## 다음 task가 알아야 할 것
- `src/points/earn.js:6`: 적립 = `percentOf(order.amounts.total, 1%)`. `src/orders/order.js:35`에서 주문 생성 때 호출.
- 참고용 계산(가설, 확인 안 됨): O-1042는 상품 28,270 - 쿠폰 3,000 = 25,270, 배송비 3,000, 포인트 사용 1,500이라 total 26,770 → 268P. 237P는 23,770(배송비 3,000을 뺀 값)의 1%와 같다.
- `src/gift/gift-points.js:6`에 같은 식이 있음. 테스트는 `npm test`.

---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "고객센터 기준 237P를 기대값으로 삼는다. 계산식은 확인하지 않았다."
  - "다른 주문의 기대값은 고객센터 계산과 같은 방식이라고 가정한다."
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "`src/gift/gift-points.js`가 `earn.js`나 공용 함수를 쓰면 수정 범위가 겹칠 수 있다. fix에서 확인이 필요하다."
recommended_next: null
knowledge_candidates:
  - "선물하기 적립(src/gift/gift-points.js)은 다른 팀과 같이 보는 중이라 이번 범위에서 뺌 (사람)"
---
## 요약
적립 예정 포인트가 고객센터 계산보다 많게 나오는 버그의 intent 초안을 썼다. 기대값은 O-1042에서 237P이다. 선물하기 적립, 영수증 글자, 이미 적립된 포인트의 재계산은 비목표로 뒀다.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: `percentOf(order.amounts.total, POINT_RATE_PERCENT)`로 계산한다. 원인은 분석하지 않았다.
- 테스트는 `npm test`(`node --test`)이다. 샘플 주문은 `examples/O-1042.json`이다.
- 참고용 계산: O-1042의 상품 합계는 28,270원이고, 쿠폰 3,000원과 사용 포인트 1,500원을 빼면 23,770원이다. 이것의 1%가 237P이다. 가설이며 intent에는 쓰지 않았다.

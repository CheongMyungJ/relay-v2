---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수 포인트 = 저장된 earned − 남은 상품으로 재계산한 적립(쿠폰과 사용 포인트는 남은 주문에 그대로, 배송비 제외, 버림)"
    why: "사람이 직접 기준을 지정함. R-0311은 403 − 271 = 132P로 정산팀 값과 일치"
    by: human
  - what: "팀 지식의 '비율 안분' 규칙 대신 사람의 이번 기준을 따른다"
    why: "사람의 지금 말이 팀 지식 earn-basis.md의 부분 환불 규칙과 어긋남"
    by: human
assumptions:
  - "남은 상품 금액은 이전 환불(alreadyRefunded)까지 뺀 값이다. refund.js의 remainingGoods와 같은 계산"
rejected:
  - "비율 안분 후 버림(팀 지식 earn-basis.md): 사람이 기준이 아니라고 함. 같은 예에서 약 111P로 정산팀 132P와 맞지 않음"
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 항목은 앞 Work(w-20261004-001)에서 왔고 기준 브랜치에 아직 없다. 그 Work가 refund.js를 이미 고쳤을 수 있음, 머지 대기"
  - "여러 번 나눠 환불할 때 회수 합계가 earned를 넘지 않는지는 fix에서 확인해야 한다"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/points/earn-basis.md — 부분 환불 회수 포인트 = 주문에 저장된 원래 적립 포인트 − 남은 상품으로 다시 계산한 적립 포인트. 적립은 (남은 상품 금액 − 쿠폰 − 사용 포인트)의 1%, 배송비 제외, 1P 미만 버림. 쿠폰 할인과 사용 포인트는 남은 주문에 그대로 둔다. 비율 안분 규칙은 정산팀 기준과 달라 대체한다 (사람)"
  - "업무 사실: 정산팀 대조 기준 R-0311(O-1077)의 회수 포인트는 132P (사람)"
---
## 요약
사람이 알려 준 기준으로 의도를 고쳤다. 회수 포인트는 원래 적립에서 남은 상품으로 다시 계산한 적립(쿠폰과 사용 포인트 유지, 배송비 제외, 버림)을 뺀 값이다. R-0311은 132P가 된다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js`의 `pointsRecovered: percentOf(refundGoods, POINT_RATE_PERCENT)`가 환불 상품 금액만 반올림해 계산한다. `remainingGoods`가 이미 같은 함수에 있다.
- `src/money.js`의 `percentOf`는 반올림이다. 버림 함수는 아직 없다. 다른 호출처(적립, 선물)는 이번 범위 밖이다.
- 검산: 47,310 − 13,130 = 34,180, − 5,000 − 2,000 = 27,180 → 271P. 403 − 271 = 132P.
- 테스트: `npm test`(node --test), 현재 20개 통과. `test/refund.test.js`가 부분 환불을 다룬다.
- 참고 지식: docs/knowledge/points/earn-basis.md. 부분 환불 규칙은 사람의 지금 기준과 달라 verify에서 고친다.

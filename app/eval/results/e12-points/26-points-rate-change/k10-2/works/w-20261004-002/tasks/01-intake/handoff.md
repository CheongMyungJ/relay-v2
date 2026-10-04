---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부분 환불 회수 = 저장된 적립 포인트 − 남은 상품으로 다시 계산한 적립(버림). 쿠폰·사용 포인트는 남은 주문에 둠"
    why: "사람 답: R-0311은 132P가 맞다(403 − 271)"
    by: human
assumptions:
  - "남은 상품 금액은 이전 환불(alreadyRefunded)과 이번 환불을 모두 뺀 금액으로 본다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 earn-basis.md의 부분 환불 회수식(환불 금액의 적립률% 버림)이 사람 답과 다르다. verify가 그 항목을 고쳐야 한다"
  - "src/points/earn.js와 src/gift/gift-points.js는 옛 기준(결제 금액 반올림)이다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 이번 범위 밖"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/points/earn-basis.md — 부분 환불 회수 = 저장된 원래 적립 포인트 − 남은 상품으로 다시 계산한 적립(남은 상품 − 쿠폰 − 사용 포인트의 적립률% 버림, 배송비 제외). 쿠폰·사용 포인트는 남은 주문에 두고 안분하지 않음. 예: O-1077/R-0311 403−271=132P (사람)"
---
## 요약
부분 환불 회수 포인트를 정산팀 기준(원래 적립 − 남은 상품 재계산 적립, 버림)으로 맞추는 버그 수정 의도 초안을 썼다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js:34`: 현재 `percentOf(refundGoods, POINT_RATE_PERCENT)`. `src/money.js`의 `percentOf`는 반올림(Math.round)이라 버림이 필요하면 별도 처리.
- `createRefund`의 `remainingGoods`(같은 파일 26행)가 남은 상품 금액이다. `order.points.earned`가 저장된 적립이다.
- 현재 R-0311: 13,130 × 1% = 131P(반올림). 기대 132P.
- 테스트: `npm test`(node --test), `test/refund.test.js:20`은 기존 회수 100P 기대. 새 식과 맞는지 확인.
- 참고 지식: docs/knowledge/points/earn-basis.md (일부 사람 답과 어긋남).

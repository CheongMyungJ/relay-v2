---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "부분 환불 회수 포인트 = 저장된 적립 포인트 - (남은 상품 금액 - 쿠폰 - 사용 포인트)의 1% 버림"
    why: "사람이 정산팀 계산 기준으로 알려 줌. O-1077/R-0311에서 403 - 271 = 132로 정산팀 값과 맞음"
    by: human
  - what: "올림 기준은 쓰지 않는다"
    why: "사람이 올림이 아니라고 답함"
    by: human
assumptions:
  - "쿠폰 할인과 사용 포인트는 남은 주문 기준으로 한 번만 뺀다 (여러 번 나눠 환불해도 같음)"
rejected:
  - "환불 상품 금액 x 1% 올림: 사람이 아니라고 답함"
open_questions: []
intent_deviation: null
risks:
  - "팀 지식(refund-recovery-vs-earn-basis.md)의 '환불 상품 금액 x 1% 버림' 식과 이번 정산팀 식이 다르다. 그 지식은 앞 Work(w-20261004-001)에서 왔고 머지 대기 중이라 이 브랜치의 코드는 아직 옛 식(반올림)이다"
  - "여러 번 나눠 환불할 때 합계가 저장된 적립값을 넘지 않는지, 남은 상품 금액이 쿠폰+사용 포인트보다 적을 때 음수가 되지 않는지 확인이 필요하다"
recommended_next: null
knowledge_candidates:
  - "부분 환불 포인트 회수는 저장된 적립 포인트 - 남은 상품으로 다시 계산한 적립((남은 상품 금액 - 쿠폰 - 사용 포인트)의 1%, 배송비 제외, 1P 미만 버림)이다. 쿠폰과 사용 포인트는 남은 주문에 그대로 둔다. 예: O-1077/R-0311은 403 - 271 = 132P (사람)"
---
## 요약
정산팀 기준(저장 적립 - 남은 상품 기준 재계산 적립)에 맞춰 부분 환불 회수 포인트를 고치는 intent 초안을 썼다. 재현 예시는 O-1077/R-0311이고 기대값은 132P이다(지금은 131P).
## 다음 task가 알아야 할 것
- `src/orders/refund.js`의 `createRefund`가 `percentOf(refundGoods, POINT_RATE_PERCENT)`로 회수 포인트를 계산한다. `percentOf`(`src/money.js`)는 반올림이다.
- 남은 상품 금액 `remainingGoods`는 이미 같은 함수에서 계산한다.
- 테스트: `npm test`(node --test). 기존 `test/refund.test.js`가 있다.
- 참고 지식: `docs/knowledge/refund-recovery-vs-earn-basis.md`(기준 브랜치에는 없음). 식이 이번 요청과 다르다.
- 예시 파일: `examples/O-1077.json`, `examples/R-0311.json`.

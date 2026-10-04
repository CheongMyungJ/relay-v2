---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트 재계산을 refund.js 안의 작은 함수로 두고 earn.js는 재사용하지 않았다"
    why: "earn.js는 결제 금액을 반올림해 규정과 다르고, 적립 계산은 비목표라 건드리지 않음"
    by: ai
assumptions:
  - "이전 부분 환불이 있어도 남은 상품 금액 기준으로 재계산하며 이전 회수분은 따로 차감하지 않는다(intake와 같은 가정)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "src/points/earn.js는 결제 금액(배송비 포함)을 반올림해 적립 규정과 다르다. 비목표라 고치지 않음"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트 = 저장된 원래 적립 − (남은 상품 − 쿠폰 − 사용 포인트)의 1% 버림, 쿠폰·사용 포인트는 남은 주문에 그대로 둔다 (사람)"
---
## 요약
회수 포인트를 원래 적립 − 남은 상품 재계산 적립(버림)으로 바꿨다. O-1077/R-0311은 132P. `npm test` 21개 통과.
## 다음 task가 알아야 할 것
- `src/orders/refund.js`: `createRefund`의 `pointsRecovered`, 새 `remainingEarn`
- 재현 테스트: `test/refund.test.js` 마지막 테스트
- `refundAmount`와 `src/format/`은 변경 없음

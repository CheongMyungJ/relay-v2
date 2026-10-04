---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트 = 저장된 원래 적립 − (남은 상품 − 쿠폰 − 사용 포인트)의 1% 버림"
    why: "사람이 직접 알려 준 규칙. O-1077/R-0311에서 403 − 271 = 132로 정산팀 값과 일치"
    by: human
  - what: "비목표에 추가 항목 없음"
    why: "사람이 '추가 없음' 선택"
    by: human
assumptions:
  - "alreadyRefunded가 있는 경우 남은 상품 금액은 이전 환불분까지 뺀 값으로 계산한다 (기존 remainingGoods와 같은 방식)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 point-earn-base-excludes-shipping은 앞 Work(w-20261004-001)에서 만든 것으로 머지 대기. 적립 계산(src/points/earn.js)이 앞 Work에서 이미 고쳐졌을 수 있음"
recommended_next: null
knowledge_candidates:
  - "부분 환불의 회수 포인트는 '저장된 원래 적립 − 남은 상품 기준으로 다시 계산한 적립(상품−쿠폰−사용 포인트의 1% 버림, 배송비 제외)'이다. 환불 상품 금액의 1%를 반올림하는 방식은 틀리다 (사람)"
---
## 요약
부분 환불 회수 포인트 규칙을 사람에게 확인받아 intent 초안을 썼다. 예시 O-1077/R-0311은 132P가 되어야 한다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js` createRefund: 현재 `pointsRecovered: percentOf(refundGoods, POINT_RATE_PERCENT)`이며 `percentOf`(`src/money.js`)는 반올림 (참고용, 원인 확정 아님)
- 남은 상품 금액은 같은 함수의 `remainingGoods`에 이미 있음
- 테스트: `npm test` (현재 20개 통과), 환불 테스트는 `test/refund.test.js`
- 참고 지식: docs/knowledge/point-earn-base-excludes-shipping.md (앞 Work, 머지 대기)

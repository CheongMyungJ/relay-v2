---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "회수 포인트 = 저장된 원래 적립 포인트 − 남은 상품으로 다시 계산한 적립 포인트 (기준 금액은 쿠폰·사용 포인트를 뺀 금액, 1P 미만 버림)"
    why: "사람이 정산팀 규칙으로 알려 줌. O-1077/R-0311에서 403 − 271 = 132로 정산팀 값과 맞음"
    by: human
  - what: "비목표: cancelOrder, 저장된 주문·처리 끝난 환불 재계산, 환불 금액·영수증 글자"
    why: "요청 원문과 사람의 선택"
    by: human
assumptions: []
rejected:
  - "단순 환불 금액 × 1% 올림: 사람이 아니라고 함"
open_questions: []
intent_deviation: null
risks:
  - "이전에 부분 환불한 내역(alreadyRefunded)이 있으면 '원래 적립 − 남은 상품 적립'이 앞선 환불의 회수분을 포함해 중복될 수 있다. fix에서 어떻게 볼지 확인 필요"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트 = 주문에 저장된 원래 적립 포인트 − 남은 상품으로 다시 계산한 적립 포인트. 적립은 (상품 − 쿠폰 − 사용 포인트)의 1%, 배송비 제외, 1P 미만 버림. 쿠폰·사용 포인트는 남은 주문에 그대로 둠. 예: R-0311은 132P (사람)"
  - "고칠 지식: docs/knowledge/points/earn-base-and-rounding.md — 부분 환불 회수 포인트는 상품 금액 기준이 아니라 위 차감 방식으로 계산한다 (사람)"
---
## 요약
부분 환불 회수 포인트를 정산팀 규칙(원래 적립 − 남은 상품 재계산 적립, 버림)으로 맞추는 intent 초안을 썼다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js:34`: 지금은 `percentOf(refundGoods, 1)`(반올림)이라 R-0311이 131P.
- `src/money.js`의 `percentOf`는 반올림이다. 버림 도우미는 팀 지식의 `percentOf**Floor**`를 참고하되 현재 코드에는 없다.
- 계산 예: 남은 상품 47310 − 13130 = 34180, 기준 34180 − 5000 − 2000 = 27180, 1% 버림 271, 403 − 271 = 132.
- 기존 테스트: `test/refund.test.js:20`(회수 100P)이 새 규칙과 맞는지 확인 필요.
- 참고: `docs/knowledge/points/earn-base-and-rounding.md`는 이 브랜치에 아직 없다(Work w-20261004-001, 머지 대기).
- 테스트 명령: `npm test`

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트 = 저장된 원래 적립 포인트 − 남은 상품으로 재계산한 적립 포인트. 적립은 (상품−쿠폰−사용 포인트)의 1%, 배송비 제외, 버림"
    why: "사람이 정산팀 기준으로 직접 알려 줌. O-1077/R-0311로 403−271=132P 확인"
    by: human
assumptions:
  - "남은 상품 재계산 때 쿠폰과 사용 포인트는 전액 그대로 뺀다(사람 설명: 남은 주문에 그대로 둠)"
rejected:
  - "1% 올림(132P): 사람이 올림이 아니라고 답함. 정산팀 식은 원래 적립 − 남은 상품 재계산 적립(버림)"
open_questions: []
intent_deviation: null
risks:
  - "alreadyRefunded가 있는 여러 번 부분 환불에서 '원래 적립 − 남은 재계산'이 이전 환불 회수분을 포함하게 된다. 이번 환불분만 회수하는지(이전 단계 재계산과의 차이) fix에서 확인 필요"
  - "docs/knowledge/points/earn-basis.md는 w-20261004-001에서 왔고 기준 브랜치에 아직 없다. 적립 기준이 같은 규칙이므로 pointsFor(src/points/earn.js)가 이 브랜치에 아직 없을 수 있음, 앞 Work 머지 대기"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트 = 주문에 저장된 원래 적립 포인트 − 남은 상품으로 재계산한 적립 포인트. 적립은 (상품−쿠폰−사용 포인트)의 1%, 배송비 제외, 1P 미만 버림. 쿠폰·사용 포인트는 남은 주문에 그대로 둠 (사람)"
  - "고칠 지식: docs/knowledge/points/earn-basis.md — 부분 환불 회수는 환불 상품 금액의 1%가 아니라 원래 적립 − 남은 상품 재계산 적립(버림)이다 (사람)"
---
## 요약
부분 환불 회수 포인트를 정산팀 방식(원래 적립 − 남은 상품 재계산 적립, 버림)으로 맞추는 intent 초안을 썼다. 환불 금액, 영수증, 이미 처리한 내역은 건드리지 않는다.
## 다음 task가 알아야 할 것
- 현재 코드: `src/orders/refund.js`의 `pointsRecovered: percentOf(refundGoods, POINT_RATE_PERCENT)`. `percentOf`(`src/money.js`)는 반올림이라 13,130×1% = 131.3 → 131P.
- 남은 상품 금액은 같은 파일의 `remainingGoods`로 이미 계산한다.
- 예시: `examples/O-1077.json`(earned 403), `examples/R-0311.json`. 테스트는 `npm test`(`test/refund.test.js`).
- 참고 지식: `docs/knowledge/points/earn-basis.md`(기준 브랜치에 아직 없음). 적립 계산 `pointsFor`는 `src/points/earn.js`에 있을 수 있다.

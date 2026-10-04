---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "회수 포인트 = 저장된 적립 포인트 − 남은 상품으로 다시 계산한 적립(쿠폰·사용 포인트 차감, 배송비 제외, 1P 미만 버림)"
    why: "사람이 정산팀 계산 방식으로 직접 답함. O-1077은 403 − 271 = 132P로 맞음"
    by: human
assumptions:
  - "남은 상품 금액은 이전 부분 환불(alreadyRefunded)까지 뺀 값으로 본다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "같은 주문에 부분 환불이 여러 번이면 '원래 적립 − 남은 적립'이 이전 환불에서 회수한 몫까지 포함한다. 이번 환불분만 회수하려면 이전 회수분을 빼야 하는데, 입력(alreadyRefunded)에 이전 회수 포인트가 없다. fix에서 확인 필요"
  - "남은 상품으로 다시 계산한 적립이 저장된 적립보다 클 수 있는지(음수 회수) 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "부분 환불 회수 포인트 = 주문에 저장된 적립 포인트 − 남은 상품으로 다시 계산한 적립(상품 − 쿠폰 − 사용 포인트의 1%, 배송비 제외, 1P 미만 버림). 환불분 금액만 따로 1% 하지 않는다. 예: O-1077/R-0311은 132P (사람)"
---
## 요약
부분 환불의 회수 포인트가 정산팀 계산과 1P 어긋난다는 요청(O-1077/R-0311: 131P vs 132P)을 bugfix 의도로 정리했다. 사람이 정산팀 계산식을 알려 주어 기대값을 132P로 정했다.
## 다음 task가 알아야 할 것
- `src/orders/refund.js:36`: `pointsRecovered: percentOf(refundGoods, POINT_RATE_PERCENT)`. 환불분 금액만 1% 한다 (확인 안 된 관찰, 원인 판단 아님).
- `src/money.js` `percentOf`는 `Math.round`다. 팀 지식은 버림이다. `earnPoints`(`src/points/earn.js`)도 아직 반올림이다. 지식 항목은 w-20261004-001에서 왔고 기준 브랜치에는 아직 없다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기.
- 기존 테스트: `test/refund.test.js:20`가 `pointsRecovered` 100을 확인한다. `npm test` 20개 통과 상태.
- 계산 예: 47,310 − 13,130 = 34,180; −5,000 −2,000 = 27,180 → 271P; 403 − 271 = 132P.
- 참고할 팀 지식: docs/knowledge/points/earn-rule.md (이 브랜치에는 파일이 없음)

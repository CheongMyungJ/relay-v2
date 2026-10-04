---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립 기준을 배송비 제외 상품 금액(상품−쿠폰−사용 포인트) 버림으로 하는 pointsFor를 추가하고 일반·선물이 함께 쓴다"
    why: "intent의 O-1107=486P 예외 조항과 docs/knowledge/points/earn-basis.md 규칙"
    by: ai
  - what: "환불 회수 비율을 REFUND_RECOVERY_RATE_PERCENT(1)로 분리한다"
    why: "intent 제약: 환불 회수는 적립률 변경 영향을 받으면 안 됨"
    by: ai
assumptions:
  - "선물하기도 같은 새 적립률과 기준을 쓴다"
rejected:
  - "비율 상수만 변경: O-1107이 547P가 되어 486P와 다름"
open_questions: []
intent_deviation: null
risks:
  - "기존 테스트 기대값 변경 2건: test/order.test.js 500→1000, test/gift.test.js 300→600 (2% 반영). 약화 여부는 verify가 판단"
  - "앞 Work(w-20261004-001/002)가 같은 pointsFor를 고쳤을 수 있음, 머지 대기. 머지 시 src/points/earn.js, src/orders/refund.js 충돌 가능"
  - "환불 회수 상수 REFUND_RECOVERY_RATE_PERCENT는 이 브랜치에서 새로 만든 것으로, 앞 Work의 createRefund(원래 적립−재계산) 방식과 합칠 때 정리 필요"
recommended_next: null
knowledge_candidates:
  - "적립률 2%(2026-10-04 배포부터). 환불 회수 비율은 적립률과 분리해 REFUND_RECOVERY_RATE_PERCENT(1)로 두고 정산팀과 따로 정한다 (사람)"
---
## 요약
적립률을 2%로 올리고 적립 기준을 배송비 제외 상품 금액 버림으로 맞춰 O-1107이 486P가 되게 했다. 환불 회수는 별도 상수로 분리해 131P 그대로다. `npm test` 24개 통과.
## 다음 task가 알아야 할 것
- `src/points/earn.js` `pointsFor`, `src/config.js` `POINT_RATE_PERCENT=2`, `REFUND_RECOVERY_RATE_PERCENT=1`
- 확인: `node src/cli.js examples/O-1107.json` → 486P, `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → -131P
- 기존 테스트 2건 기대값 변경(order, gift). 새 테스트 `test/earn-rate.test.js`

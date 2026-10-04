---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(환불 회수 분리, 음수 적립 경계)을 반영하지 않는다"
    why: "회수 1% 유지는 앞서 사람이 정한 사항이고, 음수 경계는 이번 범위 밖"
    by: human
  - what: "회수가 별도 상수라 실패인 완료조건을 실패 그대로 완료 화면으로 보낸다"
    why: "사람 지시에 따른 의도적 제외라 사람이 완료 화면으로 가기를 골랐다"
    by: human
  - what: "order/gift 테스트 기댓값 변경은 약화 아님으로 판정한다"
    why: "단언은 그대로이고 기댓값만 2% 기준으로 갱신"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation:
  summary: "부분 환불 회수가 적립률 상수와 분리되어 1%로 남았고, 적립 기준 금액(배송비 제외·버림)도 바뀌었다"
  evidence: "src/orders/refund.js:34 REFUND_RECOVERY_RATE_PERCENT, src/points/earn.js earnOn. 회수는 사람 지시, 기준 금액은 486P를 맞추는 데 필요"
risks:
  - "부분 환불 회수는 1% 단순 곱이라 2% 적립 주문에서 적립의 절반 수준. 정산팀 결정 대기"
  - "앞 Work(w-20261004-001, -002)에서 고쳤을 수 있음, 머지 대기. 머지 시 earn.js·refund.js 충돌 가능"
  - "쿠폰+사용 포인트가 상품 금액을 넘으면 음수 적립 가능(기존 경계)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건은 사람이 반영하지 않기로 했다. 완료조건 6개 중 5개 통과, "적립 및 회수가 상수 한 곳"은 회수 분리 때문에 실패(의도적). npm test 24개 통과, O-1107 486P.
남긴 지식: docs/knowledge/refund-recovery-rate-stays-1-percent.md
## 다음 task가 알아야 할 것
- `src/orders/refund.js:34` 회수는 `REFUND_RECOVERY_RATE_PERCENT`(1%) 단순 곱. 정산팀 결정 후 별도 Work에서 저장 적립 기준으로 변경
- 확인: `node src/cli.js examples/O-1107.json` → 486P, `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → 131P
- 변경된 테스트: test/order.test.js, test/gift.test.js(기댓값만), 신규 test/earn.test.js

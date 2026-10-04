---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "신규 적립률만 2%로 바꾸고 환불 회수 로직은 건드리지 않는다. 회수율은 옛 1%를 `REFUND_RECOVERY_RATE_PERCENT`로 분리해 유지한다"
    why: "사람이 '환불 회수 포인트를 새 비율로 계산할지는 정산팀과 따로 정하기로 했으니 환불 회수 로직은 건드리지 말라'고 답함"
    by: human
  - what: "적립 기준을 상품−쿠폰−사용 포인트, 버림으로 구현한다 (earnBase, pointsForBase, earnPoints)"
    why: "팀 지식 docs/knowledge/points/earn-base.md와 intent 제약, O-1107 486P 조건"
    by: ai
  - what: "선물 적립은 earnPoints를 그대로 쓴다"
    why: "팀 지식 docs/knowledge/points/earn-base.md: 선물 적립도 같은 기준"
    by: ai
assumptions:
  - "부분 환불 회수 규칙(저장된 earned − 남은 적립)은 환불 회수 로직 변경이라 이번에 적용하지 않았다"
rejected:
  - "환불 회수까지 2%로 올리기: 사람이 이번 범위에서 뺌 (정산팀과 따로 정함)"
open_questions: []
intent_deviation:
  summary: "intent는 환불 회수도 같은 2%를 쓴다고 했지만, 사람이 환불 회수는 건드리지 말라고 해서 환불 회수는 1% 그대로다"
  evidence: "사람의 답: 환불 회수 포인트를 새 비율로 계산할지는 이번 범위가 아니고 정산팀과 따로 정한다"
risks:
  - "환불 회수는 1% 반올림 그대로라 적립(2% 버림)과 비율이 다르다. 2%로 적립된 주문을 부분 환불하면 적립보다 적게 회수된다"
  - "1%로 적립된 기존 주문에 부분 환불 규칙(저장된 earned − 남은 적립)을 적용하면 음수가 된다 (O-1077/R-0311: 403 − 543). 회수 규칙을 정할 때 처리해야 함"
  - "기존 테스트 기대값 변경: test/order.test.js:26 (500→1000), test/gift.test.js:14 (300→600). 율 변경에 따른 값이며 약화는 아님"
  - "앞 Work(w-20261004-001, w-20261004-002)에서 같은 적립 기준과 회수 규칙을 고쳤을 수 있음, 머지 대기. 머지할 때 earn.js와 refund.js가 겹칠 수 있음"
recommended_next: null
knowledge_candidates:
  - "정하지 않음: 환불 회수 포인트를 새 적립률(2%)로 계산할지 — 정산팀과 따로 정함, 지금 코드는 `REFUND_RECOVERY_RATE_PERCENT = 1`로 옛 율 유지 (사람)"
  - "적립률은 2026-10-04 배포부터 기본 1%에서 2%로 올림. 이미 적립된 포인트는 다시 계산하지 않는다 (사람)"
---
## 요약
적립률을 2%로 올리고 적립 기준을 배송비 제외·버림으로 맞춰 O-1107이 486P가 되게 했다. 환불 회수는 사람 지시로 건드리지 않고 옛 1%를 유지했다.
## 다음 task가 알아야 할 것
- `src/points/earn.js`: `earnBase`, `pointsForBase`, `earnPoints`. `src/gift/gift-points.js`는 이를 호출한다.
- `src/config.js`: `POINT_RATE_PERCENT = 2`, `REFUND_RECOVERY_RATE_PERCENT = 1`(`src/orders/refund.js:34`).
- 재현 테스트: `test/earn-rate.test.js`. `npm test` 22개 통과.
- `src/format/`은 변경하지 않았다.
- 기존 테스트 기대값 2곳을 율에 맞춰 바꿨다(위 risks 참고).

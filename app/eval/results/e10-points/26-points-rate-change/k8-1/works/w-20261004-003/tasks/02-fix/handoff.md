---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "환불 회수율을 적립률과 분리해 REFUND_RECOVER_PERCENT=1로 둔다"
    why: "intent 비목표: 환불 회수 계산은 현행 유지(정산팀과 따로 정함)"
    by: ai
  - what: "적립 계산을 earn.js의 earnBase/earnOn/earnPoints로 구현하고 선물하기가 이를 쓴다"
    why: "docs/knowledge/points/earn-rule.md 규칙"
    by: ai
assumptions:
  - "기존 order/gift 테스트의 적립 기대값은 2%에 맞춰 두 배로 바꾸는 것이 의도에 맞다"
rejected:
  - "POINT_RATE_PERCENT 값만 2로 변경: 배송비 포함·반올림이라 O-1107이 547P가 되고 환불 회수도 2%가 됨"
open_questions: []
intent_deviation: null
risks:
  - "기존 테스트 2건의 기대값 변경(test/order.test.js, test/gift.test.js): 약화 여부는 verify 판단"
  - "환불 회수는 1% 반올림 그대로라 적립 2%와 불일치. 정산팀 결정 대기"
  - "앞 Work(w-20261004-001/002)에서 환불 회수 규정을 고쳤을 수 있음, 머지 대기"
  - "저장된 주문의 points.earned는 재계산하지 않음(코드상 저장 값만 사용). src/format/ 미변경"
recommended_next: null
knowledge_candidates:
  - "고칠 지식: docs/knowledge/points/earn-rule.md — 기본 적립률이 1%에서 2%로 바뀜. 기준 금액과 1P 미만 버림은 그대로 (사람)"
  - "환불 회수율은 적립률과 분리된 REFUND_RECOVER_PERCENT(1%)이며 새 비율 적용은 정산팀과 따로 정한다 (사람)"
---
## 요약
적립률을 2%로 올리고 적립 규정(상품−쿠폰−포인트, 배송비 제외, 버림)을 `earn.js`에 구현했다. 선물하기가 이를 공유한다. 환불 회수는 별도 상수 1%로 분리해 결과가 변하지 않는다. O-1107은 486P.
## 다음 task가 알아야 할 것
- `src/config.js`: `EARN_RATE_PERCENT=2`, `REFUND_RECOVER_PERCENT=1`
- `src/points/earn.js`: 적립 계산 한 곳. `src/gift/gift-points.js`가 위임
- 새 테스트 `test/earn.test.js`, `npm test` 25개 통과
- 기존 테스트 기대값 변경: order.test.js 500→1000, gift.test.js 300→600

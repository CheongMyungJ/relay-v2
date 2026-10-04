---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "적립률과 환불 회수 비율 상수를 분리하고 환불은 1%·반올림 그대로 둔다"
    why: "intent 비목표: 환불 회수 계산은 지금 동작 그대로"
    by: ai
  - what: "선물하기는 일반 주문의 earnPoints를 그대로 쓴다"
    why: "intent: 선물하기도 같은 규정. 팀 지식 docs/knowledge/points/earn-rule.md"
    by: ai
assumptions:
  - "기존 테스트 2건(order 500→1000, gift 300→600)은 2% 적용에 따른 기대값 변경이며 약화가 아니라고 판단"
rejected:
  - "상수만 2로 변경: 배송비 포함 금액이라 547P가 되고 환불 회수도 바뀐다"
open_questions: []
intent_deviation: null
risks:
  - "기존 테스트 기대값 2건 변경(test/order.test.js, test/gift.test.js)"
  - "앞 Work(w-20261004-002)에서 earn.js를 고쳤을 수 있음, 머지 대기. 머지 시 src/points/earn.js 충돌 가능"
  - "저장된 주문 영수증 출력은 src/format/ 미변경이라 같지만 영수증 글자 전용 테스트는 새로 추가하지 않음"
recommended_next: null
knowledge_candidates:
  - "2026-10-04부터 일반·선물 적립률 2%, 환불 회수는 옛 1% 유지. 코드는 `EARN_RATE_PERCENT`/`REFUND_RATE_PERCENT`로 분리 (사람)"
  - "정하지 않음: 환불 회수 비율을 2%로 바꿀지 — 정산팀과 따로 정함, 지금 코드는 `REFUND_RATE_PERCENT`=1 (사람)"
---
## 요약
O-1107 적립이 273P로 나오던 것을 486P로 고쳤다. 적립률 2%, 대상 금액은 상품−쿠폰−사용 포인트(배송비 제외), 버림. 선물하기도 같은 함수를 쓴다. 환불 회수는 1% 반올림 그대로(R-0311 131P).
## 다음 task가 알아야 할 것
- `src/config.js`: `EARN_RATE_PERCENT=2`, `REFUND_RATE_PERCENT=1`
- `src/points/earn.js`: `earnPoints`, `src/gift/gift-points.js`가 재사용
- `npm test` 23개 통과. `src/format/` 변경 없음
- 기존 테스트 기대값 2건 변경(500→1000, 300→600)

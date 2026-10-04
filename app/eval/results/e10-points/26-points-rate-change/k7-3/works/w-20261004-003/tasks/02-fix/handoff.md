---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "선물하기 적립과 환불 회수는 `LEGACY_POINT_RATE_PERCENT`(1%)로 분리해 동작을 유지한다"
    why: "intent 비목표(선물하기 계산 방식은 요청 밖)와 완료조건(기존 주문의 환불·취소 결과 불변)"
    by: ai
  - what: "적립 기준을 (total - shipping), 버림으로 맞춘다"
    why: "docs/knowledge/points-earn-basis.md, intent 제약"
    by: ai
assumptions:
  - "새 2% 주문의 부분 환불 회수는 이번 범위 밖이라 1%로 남는다고 보았다"
rejected:
  - "상수 POINT_RATE_PERCENT만 2로 변경: 선물하기·환불 회수까지 바뀌고 O-1107이 547P가 된다"
open_questions: []
intent_deviation: null
risks:
  - "2% 주문을 부분 환불하면 `refund.js`는 1%·반올림 식이라 회수가 적게 계산된다. 환불 회수식은 앞 Work(w-20261004-002)에서 고쳤을 수 있음, 머지 대기"
  - "`earn.js`는 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 머지 시 충돌 가능"
  - "기존 테스트 변경: test/order.test.js 적립 기대값 500 → 1000 (율 변경에 따른 것)"
recommended_next: null
knowledge_candidates:
  - "2026-10-04 기본 적립률을 1%에서 2%로 올렸다. 선물하기 적립과 환불 회수는 `LEGACY_POINT_RATE_PERCENT`(1%)로 남겨 두었다 (`src/config.js`)"
---
## 요약
적립률을 2%로 올리고 적립 기준을 배송비 제외·버림으로 맞췄다. O-1107은 486P가 된다. 선물하기와 환불 회수는 1%로 유지했다.
## 다음 task가 알아야 할 것
- `src/config.js`: `POINT_RATE_PERCENT = 2`, `LEGACY_POINT_RATE_PERCENT = 1`
- `src/points/earn.js:6`: floor((total - shipping) × 율 / 100)
- 재현 테스트 `test/order.test.js` 끝; `npm test` 21 통과
- 새 2% 주문의 부분 환불 회수식은 그대로 1%라 후속 확인 필요

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 README 보강(2번)만 반영하고, 환불 회수율(1번)은 반영하지 않는다"
    why: "환불 회수는 비목표이고 앞 Work(w-20261004-002)와 충돌할 수 있다"
    by: human
assumptions: []
rejected:
  - "refund.js 회수율을 이 Work에서 2%로 고치기: 범위 밖, 앞 Work 머지 대기"
open_questions: []
intent_deviation: null
risks:
  - "2% 주문의 부분 환불 회수가 1%·반올림이라 적게 회수된다. 환불 회수식은 앞 Work(w-20261004-002)에서 고쳤을 수 있음, 머지 대기"
  - "earn.js는 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 머지 시 충돌 가능"
  - "선물하기 적립은 옛 식·1%로 남아 있음(비목표)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 README 문구(사소)만 반영해 커밋했다(6e1d061). 모든 완료조건 통과, `npm test` 21 통과, O-1107은 486P다. 환불 회수율 지적(권장)은 범위 밖이라 위험으로 남겼다.
남긴 지식: docs/knowledge/points-earn-basis.md, docs/knowledge/legacy-point-rate-gift-refund.md
## 다음 task가 알아야 할 것
- `src/points/earn.js:6`: floor((total - shipping) × 율 / 100)
- `src/orders/refund.js:34`: 부분 환불 회수는 `LEGACY_POINT_RATE_PERCENT`(1%), 후속 확인 필요
- 바뀐 기존 테스트: test/order.test.js 기대값 500 → 1000 (약화 아님)

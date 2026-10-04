---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 2번(테스트 추가)만 반영하고 1번(부분 환불 회수 포인트)은 반영하지 않는다"
    why: "사람이 환불은 건드리지 말고 별도로 남기라고 함"
    by: human
assumptions: []
rejected:
  - "refund.js 회수 포인트 수정: 환불 결과가 바뀌어 비목표와 충돌 소지, 사람이 제외"
open_questions: []
intent_deviation: null
risks:
  - "버림 규칙은 O-1042 한 건과 합성 경계 케이스로만 확인함. 적립 안내 원문 미확인"
  - "src/orders/refund.js:34 부분 환불 회수 포인트는 여전히 반올림"
  - "선물하기 적립(src/gift/gift-points.js)은 배송비 포함 반올림 그대로"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 테스트 보강(2번)만 반영했고 환불(1번)은 사람이 별도로 남기라 해 반영하지 않았다. 모든 완료조건이 통과했고 `npm test`는 22개 통과다.
새 지식: docs/knowledge/points/earn-points-rule.md — 적립 계산 규칙을 다룬 기존 항목이 없음
새 지식: docs/knowledge/points/stored-earned-points.md — 저장된 적립값 규칙 항목이 없음
새 지식: docs/knowledge/format/receipt-text.md — 영수증 글자 규칙 항목이 없음
## 다음 task가 알아야 할 것
- 수정: `src/points/earn.js`, 테스트: `test/order.test.js` 마지막 2개.
- 재현: `node src/cli.js examples/O-1042.json` → 237P.
- 후속 후보: `src/orders/refund.js:34` 부분 환불 회수 포인트, `src/gift/gift-points.js`.

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(환불 회수 반올림)만 반영, 2(gift-points 래퍼)는 반영하지 않음"
    why: "사람이 차단·권장만 반영을 선택함"
    by: human
assumptions: []
rejected:
  - "gift-points 래퍼 제거: 공개 export라 유지"
open_questions: []
intent_deviation: null
risks:
  - "환불 회수는 환불 상품 금액 기준이라 쿠폰·사용 포인트 안분 규칙은 미정"
  - "적립 안내 원문을 확인하지 못함. O-1042 한 건에 맞춘 규칙"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 1건(환불 회수 버림)을 반영해 커밋했다. 완료조건 6개 모두 통과, `npm test` 25개 통과, O-1042 237P.
새 지식: docs/knowledge/points/earn-points-rule.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없음
## 다음 task가 알아야 할 것
- `src/orders/refund.js:34`가 `percentOfFloor`를 씀. 테스트는 `test/earn.test.js`.
- 지식 파일: `docs/knowledge/points/earn-points-rule.md`

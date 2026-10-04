---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "리뷰 지적 중 차단·권장(1번)만 반영, 사소(2번)는 반영하지 않음"
    why: "사람이 차단·권장만 반영을 고름"
    by: human
assumptions: []
rejected:
  - "percentOf 제거: 사소한 지적이라 반영하지 않기로 함"
open_questions: []
intent_deviation: null
risks:
  - "옛 규칙으로 저장된 주문은 earned가 새 규칙보다 커서 부분 환불 회수 합계가 earned보다 적을 수 있음"
  - "부분 환불 회수가 alreadyRefunded 입력에 의존함"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 1건 반영(전체 취소 저장값 테스트 추가, 커밋 9cd5571). 모든 완료조건 통과, `npm test` 28개 통과, O-1042 237P.
새 지식: docs/knowledge/points/earn-rule.md — 맞는 기존 항목이 없는 까닭: 팀 지식 항목이 없었음
새 지식: docs/knowledge/format/receipt-text-fixed.md — 맞는 기존 항목이 없는 까닭: 팀 지식 항목이 없었음
## 다음 task가 알아야 할 것
- 적립 규칙: `src/points/earn.js` `earnBase`/`pointsOf`
- 전체 취소는 `src/orders/refund.js:44`에서 저장된 `points.earned` 사용
- 테스트: `test/earn.test.js` (8개)

---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "리뷰 지적 1·2(사소)를 반영하지 않음"
    why: "사람이 반영하지 않음을 선택"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "옛 기준으로 저장된 주문을 부분 환불하면 회수액이 저장된 points.earned와 어긋날 수 있다"
  - "영수증 UI 출력은 직접 확인하지 않고 기존 테스트 통과로만 확인"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 결과 사소한 지적 2건(반영 안 함). 완료조건 8개 모두 통과, npm test 25개 통과. pr.md 작성.
새 지식: docs/knowledge/points/earn-base.md — 적립 기준 규칙(사람이 알려 줌)을 다룬 기존 항목이 없음
새 지식: docs/knowledge/points/stored-earned-not-recalculated.md — 저장된 earned 비재계산 규칙을 다룬 기존 항목이 없음
## 다음 task가 알아야 할 것
- 적립 기준: `src/points/earn.js`의 `earnFromAmounts`
- 명령: `npm test`

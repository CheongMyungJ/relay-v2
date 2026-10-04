---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 1번(권장, 나눠 한 환불 테스트 보강)만 반영하고 2번(사소)은 반영하지 않음"
    why: "사람이 '차단·권장만 반영'을 고름"
    by: human
assumptions:
  - "이전 환불의 회수 포인트도 같은 규칙으로 계산됐다고 본다(저장값을 읽지 않음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "저장 적립과 재계산 적립이 다른 주문에서 나눠 한 환불은 합계가 1P 어긋날 수 있음"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. earnPoints와 refund.js에 버림 계산이 따로 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 1건(권장)을 반영해 나눠 한 환불 테스트가 회차별 값(132, 83)을 검증하게 했다. 완료조건 6개 모두 통과, `npm test` 22개 통과. 수정 전 코드에서는 새 테스트 2개가 실패함을 확인했다.
새 지식: docs/knowledge/points/refund-points-recovery.md — 환불 회수 포인트 규칙을 다루는 기존 항목이 없음
## 다음 task가 알아야 할 것
- 커밋: d8d1c96(테스트 보강), 이어서 지식 커밋
- `src/orders/refund.js` `earnedFor`/`pointsBefore`, `src/money.js` `floorPercentOf`
- 영수증(`src/format/`) 변경 없음

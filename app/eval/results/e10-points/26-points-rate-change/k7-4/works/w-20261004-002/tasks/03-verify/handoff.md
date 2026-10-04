---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(사소, 마지막 assertion이 느슨함)을 반영하지 않음"
    why: "사람이 반영하지 않음을 선택"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 points-earn-basis-floor는 기준 브랜치에 아직 없고 earn.js는 반올림 그대로일 수 있음(앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기)"
  - "저장된 earned가 현재 규칙 재계산값과 다른 옛 주문은 첫 환불에서 그 차이만큼 회수에 반영됨"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(사소)은 반영하지 않았고, 완료조건 7개는 모두 통과했다. `npm test` 22개 통과, O-1077/R-0311은 132P이고 환불 금액은 13,130원이다. 바뀐 테스트 파일은 추가만 있어 약화 아님이다.
남긴 지식: docs/knowledge/partial-refund-points-recovery.md
## 다음 task가 알아야 할 것
- 검증 결과: tasks/03-verify/verification.md, PR 초안: pr.md
- 수정 위치: `src/orders/refund.js`의 `earnedOnRemaining`와 `createRefund`

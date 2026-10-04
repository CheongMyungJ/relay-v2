---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(권장 1, 사소 1)을 반영하지 않음"
    why: "사람이 '반영하지 않음'을 선택함"
    by: human
assumptions:
  - "여러 번 환불의 이전 회수분은 현재 규칙으로 재계산한 값이라는 fix 단계의 AI 가정을 그대로 둠"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "alreadyRefunded 경로는 이전 회수분을 재계산한 가정에 의존하고 테스트 1건뿐"
  - "저장된 earned가 옛 규칙이면 회수가 1~2P 어긋나거나 음수가 될 수 있음"
  - "earnPoints는 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건은 사람이 반영하지 않기로 했다. 완료조건 6개 모두 통과(`npm test` 22개, CLI 132P, 환불 금액 13,130원 동일). 바뀐 테스트 파일은 test/refund.test.js(추가만, 약화 아님). pr.md를 썼다.
고친 지식: docs/knowledge/points/partial-refund-recovery-not-proportional.md — 비례 안 한다는 함정에서 "원 적립 − 남은 상품 재계산 적립(버림)" 회수 규칙으로 바뀜
## 다음 task가 알아야 할 것
- `src/orders/refund.js:32` `recoveredBefore`: 이전 환불 회수분 재계산 가정
- 재현: `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → -132P

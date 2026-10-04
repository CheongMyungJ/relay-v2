---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 3건(권장 1, 사소 2)을 반영하지 않는다"
    why: "사람이 '반영하지 않음'을 골랐다. earnedOn 중복은 앞 Work 머지 뒤에야 합칠 수 있다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "refund.js의 earnedOn은 earnPoints와 중복이다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 머지 뒤 합쳐야 한다"
  - "src/gift/gift-points.js와 cancelOrder는 범위 밖이라 그대로 둠"
  - "두 번째 추가 테스트는 수정 전에도 통과한다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 3건은 사람이 반영하지 않기로 했다. 완료조건 6개는 모두 통과다. `npm test` 22개 통과, R-0311 회수 -132P.
고친 지식: docs/knowledge/points/earn-rule.md — 부분 환불 회수를 환불 금액의 %로 따로 계산하지 않는다는 규칙과 O-1077 사례, 바뀐 이력을 더했다 (앞 Work의 내용은 모두 살림).
## 다음 task가 알아야 할 것
- `verification.md`와 `pr.md`는 task 디렉터리에 있다.
- 커밋: efb5697(fix), 01fbf3b(지식)
- 확인: `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → 회수 -132P

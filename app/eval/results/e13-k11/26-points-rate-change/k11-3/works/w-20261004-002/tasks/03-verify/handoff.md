---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "나눠 환불 합계 테스트를 수정 전 코드에서 실패하는 입력으로 바꾼다(지적 1 반영)"
    why: "기존 입력은 수정 전에도 통과해 회귀를 막지 못함"
    by: human
  - what: "영수증의 포인트 회수 줄이 -131P에서 -132P로 바뀌는 것은 완료조건 '영수증 출력은 수정 전과 같다'를 통과로 판정"
    why: "형식과 환불 금액은 같고 값 변경은 목표에 따른 의도된 결과"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: refund.js의 earnOnRemaining은 earnPoints와 별도 구현이라 머지 뒤 합칠지 판단 필요"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(권장: 나눠 환불 테스트가 수정 전에도 통과)을 사람이 골라 반영·커밋(2259d7e)했다. 모든 완료조건이 통과이고 `npm test` 22개가 통과한다. pr.md를 썼다.
남긴 지식: 없음 (earn-basis.md의 규칙이 이미 이번 수정을 덮고 사람이 새로 알려 준 규칙이 없음)
## 다음 task가 알아야 할 것
- 수정: `src/orders/refund.js`의 `earnOnRemaining`, `createRefund`의 `pointsRecovered`
- 재현: `node src/cli.js examples/R-0311.json --order examples/O-1077.json` → 포인트 회수 -132P
- 나눠 환불 테스트는 TW-0838 → SP-0656 순서(수정 전 150 vs 149)로 수정 전 코드를 잡는다

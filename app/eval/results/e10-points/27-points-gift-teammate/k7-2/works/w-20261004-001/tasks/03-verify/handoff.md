---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(환불 회수 반올림, O-1107 기대값 출처)을 반영하지 않는다"
    why: "환불 규칙은 확인되지 않았고 intent 범위 밖이며 남은 위험으로 기록한다"
    by: human
assumptions:
  - "O-1107 기대값 243P와 버림 규칙은 고객센터 확인을 거치지 않았다"
rejected:
  - "부분 환불 회수를 버림으로 바꾸기: 환불 규칙 확인 전이고 intent 범위 밖"
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 회수(`src/orders/refund.js:34`)는 반올림이라 적립(버림)과 1P 어긋날 수 있다"
  - "버림 규칙과 O-1107 기대값은 고객센터 확인 전이다"
  - "선물하기 적립은 같은 문제가 남아 있다. 다른 팀과 맞춰야 한다"
recommended_next: null
knowledge_candidates: []
---
## 요약
변경 전체를 리뷰했고 지적 2건은 사람이 반영하지 않기로 했다. 완료조건 6개는 모두 통과했다(`npm test` 24건, O-1042 237P). `verification.md`와 `pr.md`를 썼다.
남긴 지식: docs/knowledge/saved-earned-points-never-recalculated.md, docs/knowledge/gift-points-shared-with-other-team.md, docs/knowledge/earn-points-basis-excludes-shipping.md
## 다음 task가 알아야 할 것
- 코드 변경은 `src/points/earn.js`와 새 `test/earn.test.js`뿐이다. 이 단계에서 코드는 바꾸지 않았다.
- 남은 위험: `src/orders/refund.js:34` 회수 반올림, 선물하기 적립
- 명령: `npm test`, `node src/cli.js examples/O-1042.json`

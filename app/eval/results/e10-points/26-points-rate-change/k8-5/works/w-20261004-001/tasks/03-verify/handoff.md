---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건을 모두 반영한다 (1번은 테스트 수정, 2번은 코드 변경 없음)"
    why: "사람이 '모두 반영'을 골랐다"
    by: human
assumptions:
  - "고객센터 규칙은 O-1042 237P 한 건으로 추정했다. O-1107, G-0213 기대값은 고객센터 확인이 없다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부분 환불 회수가 버림으로 바뀌어 이전보다 1P 적을 수 있고, 환불 줄 합계 회수와 적립액의 일치는 확인하지 않았다"
  - "고객센터 규칙이 문서로 확인되지 않았다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건(사소)을 모두 반영했다. 선물 테스트의 식 반복을 지웠고(커밋 79fc742), 환불 회수 기준 차이는 범위 밖이라 코드를 바꾸지 않았다. 완료조건 7개 모두 통과했고 `npm test`는 26개 통과다.
새 지식: docs/knowledge/points/earn-rule.md — 맞는 기존 항목이 없는 까닭: docs/knowledge가 비어 있었다
## 다음 task가 알아야 할 것
- 적립 계산: `src/points/earn.js`, 버림 도우미 `src/money.js`의 `floorPercentOf`
- 테스트: `test/earn.test.js`, 재현: `node src/cli.js examples/O-1042.json` → 237P
- `pr.md`는 task 디렉터리에 있다

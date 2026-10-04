---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "runPool이 결과를 입력 위치에 저장하도록 고치고, 호출부(collectResults)는 그대로 둔다"
    why: "원인이 runPool의 완료 순서 push이고 문서 계약(records는 작업 목록과 같은 순서)을 지키는 최소 수정이다"
    by: ai
assumptions: []
rejected:
  - "시험 쪽 문제: 시험은 올바르게 검사하고 있다"
open_questions: []
intent_deviation: null
risks:
  - "onChunk의 done 값은 완료 개수로 유지했다(동작 동일)"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 입력 순서여야 한다: collectResults가 인덱스로 작업과 결과를 짝짓는다 (src/runner/pool.js)"
---
## 요약
runPool이 완료 순서로 결과를 쌓아 조회 지연 시 보고서가 옆 작업에 붙던 것을 입력 위치에 저장하도록 고쳤다. 결정적 회귀 시험을 추가했다.
## 다음 task가 알아야 할 것
- 수정: `src/runner/pool.js`, 시험: `test/pool.test.js` 마지막 test
- 수정 전 `ci/batch.test.js` 10회 중 3회 실패, 수정 후 30회 모두 통과
- `npm test` 63, `npm run test:ci` 67 모두 통과

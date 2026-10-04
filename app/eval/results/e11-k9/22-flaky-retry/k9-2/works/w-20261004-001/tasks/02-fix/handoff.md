---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "runPool이 입력 순서대로 결과를 돌려주게 고침 (collector는 그대로)"
    why: "runPool 문서와 collectResults 모두 결과가 작업과 같은 순서라고 전제함"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "runPool을 쓰는 곳은 runner.js뿐임을 grep으로 확인했으나 외부 사용처는 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 입력 순서여야 한다: collectResults가 인덱스로 작업과 짝짓는다. 지연이 있는 시험(ci/)에서만 순서 뒤바뀜이 드러난다"
---
## 요약
runPool이 완료 순서로 결과를 쌓아 지연 편차 때문에 보고서가 다른 작업에 붙던 것을 입력 순서 유지로 고쳤다.
## 다음 task가 알아야 할 것
- 수정: `src/runner/pool.js` (results[start + i])
- 재현 시험: `test/pool-order.test.js`
- 수정 전 ci/batch.test.js 3/20 실패, 수정 후 40/40 통과. `npm test` 63, `npm run test:ci` 67 통과

---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "다른 곳에서 runPool 결과를 완료 순서로 가정하는 코드는 확인하지 않음 (runner.js의 collectResults는 입력 순서 가정)"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 items 순서와 같아야 한다. collectResults가 index로 짝짓기 때문이다 (src/runner/pool.js)"
---
## 요약
`runPool`이 결과를 완료 순서로 쌓아 `collectResults`의 index 매칭이 어긋나던 것을 index 저장으로 고쳤다. 병렬 4개 유지, 시험 약화 없음.
## 다음 task가 알아야 할 것
- 수정: `src/runner/pool.js`, 시험: `test/pool.test.js` 마지막 시험
- 수정 전 `ci/batch.test.js` 30회 중 6회 실패, 수정 후 0회
- `npm run test:ci` 67 통과, `npm test` 63 통과

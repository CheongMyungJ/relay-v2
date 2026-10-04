---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "runPool 결과를 입력 인덱스에 저장해 순서를 보장한다 (collector는 그대로)"
    why: "순서 짝짓기는 runPool 계약이고, 시험 코드나 시간 제한을 건드리지 않고 원인을 고친다"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 반복 30회 통과는 통계적 확인이다. 단위 시험이 결정적으로 원인을 막는다"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 완료 순서가 아니라 입력 순서여야 한다. collectResults가 인덱스로 짝짓는다. 지연 없는 로컬 시험은 이 버그를 못 잡는다"
---
## 요약
runPool이 완료 순서대로 결과를 모아 report가 이웃 job에 붙던 것을 입력 순서로 저장하게 고쳤고, 재현 단위 시험을 추가했다.
## 다음 task가 알아야 할 것
- 수정: `src/runner/pool.js` (results[start + offset])
- 시험: `test/pool.test.js` 마지막 케이스. npm test 63, test:ci 67 통과, ci/batch 30회 연속 통과

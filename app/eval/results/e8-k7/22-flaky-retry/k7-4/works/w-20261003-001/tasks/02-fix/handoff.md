---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "runPool 결과를 인덱스 위치에 넣어 items 순서를 보장한다 (병렬 4개 유지)"
    why: "원인이 완료 순서 push이고 collectResults가 순서 대응을 가정함"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "runPool을 쓰는 다른 호출자가 완료 순서에 기대고 있지 않은지는 test/ 통과 외에 확인하지 않음"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 items 순서여야 한다. collectResults가 outcomes[i]와 jobs[i]를 짝짓는다 (src/runner/pool.js, src/collect/collector.js)"
---
## 요약
runPool이 끝나는 순서대로 결과를 모아 지연이 다르면 report가 다른 job에 붙던 것을 인덱스 위치에 넣도록 고쳤다. 결정적 시험을 test/pool.test.js에 추가했다.
## 다음 task가 알아야 할 것
- 수정: `src/runner/pool.js` (results[start + i])
- 재현: `node --test ci/batch.test.js` 10회 중 약 4회 실패, 수정 후 20회 모두 통과
- test:ci 67 통과, npm test 63 통과

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "runPool 순서 수정도 이번 범위에 포함한다"
    why: "'고객사가 다르다' 오류의 원인이며 intent 완료조건에 들어 있음. 팀 지식 docs/knowledge/batch/pool-order-and-tmp-names.md"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "runPool은 ci/batch.test.js 쪽 수정과 겹칠 수 있음. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
  - "추가한 archive 시험은 가짜 시계 때문에 수정 전에도 통과함"
recommended_next: null
knowledge_candidates: []
---
## 요약
runPool 결과를 items 순서로 두고, 보고서 임시 파일 이름에 reportId와 순번을 붙여 test:ci 20회 연속 통과시켰다.
## 다음 task가 알아야 할 것
- `src/runner/pool.js`, `src/store/report-archive.js` 수정, 동시 4개 유지
- 검증: `npm test` 64 통과, `npm run test:ci` 20회 통과

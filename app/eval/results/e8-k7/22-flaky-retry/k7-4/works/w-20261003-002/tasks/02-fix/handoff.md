---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "임시 파일 이름에 reportId를 넣어 고친다. 동시성은 그대로 둔다"
    why: "팀 지식 docs/knowledge/report-temp-file-name-must-be-unique.md, keep-parallel-concurrency-4.md. 이 코드에서 원인을 실험으로 확인함"
    by: ai
assumptions:
  - "ci/batch.test.js 간헐 실패는 기준 커밋에서 따로 실행해 확인하지 않았고 pool 순서 문제로 봄"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "npm run test:ci는 ci/batch.test.js 간헐 실패(비목표) 때문에 가끔 실패한다. 완료조건 'test:ci 통과'는 그 수정이 머지되어야 안정적으로 만족됨"
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: src/runner/pool.js 순서"
recommended_next: null
knowledge_candidates:
  - "report-N 임시 파일 충돌의 원인은 src/store/report-archive.js saveReport의 시각만 쓴 임시 이름이었고, reportId를 넣어 고쳤다. 결정적 시험은 setSleep을 no-op으로 해 시각을 멈춘다."
---
## 요약
saveReport의 임시 파일 이름이 시각만 써서 동시 저장이 겹치던 것을 reportId를 넣어 고쳤다. 결정적 재현 시험을 추가했고 수정 전 실패, 수정 후 통과를 확인했다.
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js` saveReport의 tmp 이름. 시험: `test/archive.test.js` 새 시험.
- `npm test` 63 통과. `node --test ci/archive.test.js` 15회 무실패.
- `npm run test:ci`는 ci/batch.test.js(비목표)가 약 30% 실패. archive는 실패 없음.

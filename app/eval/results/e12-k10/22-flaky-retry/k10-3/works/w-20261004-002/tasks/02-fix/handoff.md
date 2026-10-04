---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "임시 파일 이름에 reportId와 호출 순번을 넣는다"
    why: "원인은 시각만으로 만든 임시 이름의 충돌. 팀 지식 docs/knowledge/runner/concurrency-order-pitfalls.md도 reportId를 넣으라고 함. 같은 reportId 동시 저장도 순번으로 막음"
    by: ai
  - what: "ci/batch.test.js의 간헐 실패는 고치지 않는다"
    why: "intent 비목표"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "`npm run test:ci`가 10회 중 3회 실패한다. 모두 ci/batch.test.js(순서 문제)이고 기준 커밋에서도 실패한다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 완료조건 `npm run test:ci` 통과는 그 머지 뒤에야 확인된다"
recommended_next: null
knowledge_candidates:
  - "report-archive의 saveReport 임시 파일 이름은 시각만으로 만들면 같은 폴더 동시 저장 때 겹친다. 지금은 reportId와 호출 순번을 넣는다. 지연이 있는 ci/archive.test.js에서만 ENOENT나 고객사 불일치로 드러난다"
---
## 요약
`saveReport`의 임시 파일 이름이 시각(ms)만으로 만들어져 동시 저장 때 겹치던 것을 고쳤다. 재현 시험을 추가했고 `ci/archive.test.js`는 20회 모두 통과했다.
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js`의 `saveReport`. 시험: `test/archive.test.js` 마지막 시험.
- `npm test` 63/63 통과. `ci/archive.test.js` 20회 중 20 통과.
- `npm run test:ci` 10회 중 3회 실패. 모두 `ci/batch.test.js`이며 기준 커밋에서도 실패한다(비목표).

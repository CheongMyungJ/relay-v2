---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "임시 파일 이름에 reportId를 넣는 것으로 고친다. 병렬 실행은 유지"
    why: "팀 지식 docs/knowledge/batch/parallel-concurrency-must-stay.md, ordering-and-tmp-file-pitfalls.md"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "npm run test:ci 전체는 ci/batch.test.js 간헐 실패(기준 커밋에서도 20회 중 4회) 때문에 가끔 실패한다. 비목표라 고치지 않음"
  - "앞 Work(w-20261004-001)에서 같은 임시 파일 이름을 고쳤을 수 있음, 머지 대기. 머지 때 충돌 가능"
recommended_next: null
knowledge_candidates:
  - "ci/archive.test.js 간헐 실패(ENOENT .tmp, 다른 고객사 보관본)의 원인은 saveReport의 시각만 쓴 임시 파일 이름이었고, reportId를 넣어 고쳤다. 같은 ms 동시 저장이 충돌한다."
---
## 요약
`saveReport`의 임시 파일 이름이 ms 시각만이라 동시 저장끼리 겹치던 것을 reportId를 넣어 고치고, 재현 테스트를 추가해 커밋했다.
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js:25`, 재현 테스트: `test/archive.test.js` 마지막 테스트.
- `ci/archive.test.js` 단독 30/30 통과, `test:ci` 30회 중 보관소 실패 0회. `npm test` 63개 통과.
- `test:ci` 전체 실패는 남은 `ci/batch.test.js` 순서 문제(기준 커밋에서도 약 20%)뿐이다.

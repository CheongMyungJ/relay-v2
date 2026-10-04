---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "동시성 유지, 재시도/skip/시간 제한 금지를 비목표와 제약에 넣음"
    why: "팀 지식의 사람 규칙(keep-parallel-concurrency-4, no-retry-skip-timeout-for-flaky)이 이번 경우에 해당함"
    by: ai
assumptions:
  - "결정적 재현 시험 추가를 완료조건에 넣음 (팀 지식의 결정적 시험 관례에 따름)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: src/runner/pool.js 순서 문제는 ci/batch.test.js 쪽이며 이번 범위 밖"
recommended_next: null
knowledge_candidates: []
---
## 요약
ci/archive.test.js의 간헐 실패를 고치는 bugfix intent 초안을 썼다. 비목표는 batch.test.js, 동시성 변경, 재시도/skip/시간 제한이다.
## 다음 task가 알아야 할 것
- 시험 명령: `npm run test:ci` (test/ + ci/), 로컬은 `npm test`
- 참고(원인 근거 아님, 유사 실패 유형): `docs/knowledge/report-temp-file-name-must-be-unique.md` (관련 위치 src/store/report-archive.js, src/util/ids.js). 같은 증상(고객사 불일치, 임시 파일 잔존)이 적혀 있으나 이번 코드에서 확인된 것은 아니다.
- 참고: `docs/knowledge/pool-results-in-items-order.md`는 batch.test.js 쪽이라 범위 밖.
- 위 knowledge 파일들은 기준 브랜치에 아직 없다(머지 대기).

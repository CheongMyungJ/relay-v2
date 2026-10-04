---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "범위는 ci/archive.test.js의 간헐 실패로 한정하고 batch.test.js는 제외"
    why: "요청 원문: batch.test.js는 따로 고쳐 리뷰 중"
    by: human
  - what: "병렬 4개 유지, 재시도/skip/시간 늘리기 금지를 제약과 완료조건에 반영"
    why: "팀 지식 flaky-test-policy.md의 규칙"
    by: human
assumptions:
  - "완료조건의 반복 실행 횟수는 fix가 정한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 두 항목은 앞 Work(w-20261004-001)에서 왔고 머지 대기 중이라 이 브랜치에 docs/knowledge/가 없다. 같은 원인이 이미 앞 Work에서 고쳐졌을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
ci/archive.test.js 간헐 실패를 근본 원인으로 고치는 bugfix intent 초안을 썼다. 팀 규칙(병렬 4개 유지, 재시도 등 금지)을 제약으로 옮겼다.
## 다음 task가 알아야 할 것
- 시험 명령: `npm run test:ci` (`package.json`), 대상 `ci/archive.test.js`. 반복 실행해 확인한다.
- 참고(원인 근거 아님, 이 브랜치에는 없음): docs/knowledge/batch/parallel-ordering-and-temp-names.md 에 `runPool` 결과 순서와 `saveReport` 임시 파일 이름 충돌 사례가 있다. 현재 코드(src/runner/pool.js, src/store/report-archive.js)를 직접 확인할 것.

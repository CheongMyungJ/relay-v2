---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "범위는 ci/archive.test.js의 간헐 실패로 한정하고 ci/batch.test.js는 제외한다"
    why: "요청에서 batch.test.js는 따로 고쳐 리뷰 중이라고 함"
    by: human
  - what: "동시 4개 유지, 재시도/skip/시간 제한 늘리기 금지를 제약에 넣는다"
    why: "팀 지식 nightly-batch-concurrency.md의 규칙"
    by: ai
assumptions:
  - "재현은 지연을 쓰는 npm run test:ci를 반복 실행하는 것으로 본다. 로컬 npm test는 늘 통과한다고 했다"
  - "반복 통과 기준 20회는 임의로 정한 값이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 파일 두 개는 앞 Work(w-20261004-001)에서 왔고 기준 브랜치에는 아직 없다. 앞 Work가 고친 코드(runPool 순서, 임시 파일 이름에 reportId 사용)도 이 브랜치에 없을 수 있다. 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
ci/archive.test.js의 간헐 실패(임시 파일 ENOENT, 보관본 고객사 불일치)를 고치는 bugfix intent 초안을 썼다. 질문 없이 초안을 썼고 open_questions는 없다.
## 다음 task가 알아야 할 것
- 시험: `ci/archive.test.js`. 실행은 `npm run test:ci`, 로컬 `npm test`는 ci/ 시험을 돌리지 않는다.
- 참고(가설, 원인 확정 아님): `src/store/report-archive.js`의 `saveReport`가 임시 이름을 `.${stamp(now())}.tmp`로 만든다. 현재 브랜치 코드는 reportId를 쓰지 않고 시각만 쓰는 것으로 보인다.
- 팀 지식 참고 경로: `docs/knowledge/batch/pool-order-and-tmp-names.md` (runPool 결과 순서, 임시 파일 이름 겹침 유형)
- 제약 규칙은 `docs/knowledge/batch/nightly-batch-concurrency.md`

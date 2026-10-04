---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "배치 병렬 동시 4개 유지와 재시도/skip/timeout 증가 금지를 제약에 넣는다"
    why: "팀 지식의 사람이 정한 규칙이며 이번 경우(간헐 실패, 시험 흔들림)에 해당한다"
    by: ai
  - what: "ci/batch.test.js 간헐 실패는 비목표로 둔다"
    why: "요청에서 별도 Work로 리뷰 중이라고 명시함"
    by: human
assumptions:
  - "재현은 `npm run test:ci` 20회 반복으로 확인한다 (팀 지식의 예시 횟수)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: runPool 결과 순서(src/runner/pool.js). 범위를 넓히지 않는다"
  - "docs/knowledge/는 이 브랜치에 아직 없다. 팀 지식 항목은 앞 Work에서 온 것이다"
recommended_next: null
knowledge_candidates: []
---
## 요약
ci/archive.test.js의 간헐 실패(`ENOENT ... .tmp`, 고객사 불일치) 원인을 찾아 고치는 bugfix 의도 초안을 썼다. 사람이 정한 규칙(재시도/skip/timeout 금지, 병렬 4 유지)은 제약에 옮겼다.
## 다음 task가 알아야 할 것
- 시험 스크립트: `npm run test:ci` (test/ + ci/), `npm test`는 ci/ 제외라 늘 통과한다.
- 참고(원인 근거 아님, 앞 Work 조사): 보관 임시 파일 이름의 고유성(`docs/knowledge/archive-tmp-name-needs-unique-part.md`, 적용 src/store/report-archive.js saveReport), 결과 순서(`docs/knowledge/runpool-results-in-items-order.md`). 이 브랜치에는 이 문서들이 없고 코드가 현재 상태와 다를 수 있으니 직접 확인한다.
- 위 사실이 이번 버그의 원인이라는 확인은 안 됨. fix에서 직접 재현해 판단한다.

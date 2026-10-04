---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "이번 범위는 ci/archive.test.js의 간헐 실패로 한정하고 ci/batch.test.js는 뺀다"
    why: "요청: batch 쪽은 따로 고쳐 리뷰 중"
    by: human
assumptions:
  - "원인은 제품 코드(src/store/report-archive.js 쪽)에 있다고 보고 시험은 고치지 않는 방향으로 썼다. 원인은 확인하지 않았다."
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 flaky-test-policy.md는 앞 Work(w-20261004-001)에서 왔고 기준 브랜치에는 아직 없다. 머지 대기 중이다."
recommended_next: null
knowledge_candidates: []
---
## 요약
ci/archive.test.js 간헐 실패를 고치는 bugfix 의도 초안을 썼다. 팀 지식의 flaky 규칙(재시도·skip·시간 제한 증가 금지)을 제약에 옮겼다.
## 다음 task가 알아야 할 것
- 보관소 코드: `src/store/report-archive.js` (임시 파일 `.tmp` 이름이 증상에 나옴, 코드는 읽지 않음)
- 시험: `ci/archive.test.js`, 실행은 `npm run test:ci` (로컬 `npm test`는 지연 0이라 가림)
- 참고 지식: `docs/knowledge/testing/flaky-test-policy.md` (앞 Work에서 온 것, 이 브랜치에는 파일 없음)

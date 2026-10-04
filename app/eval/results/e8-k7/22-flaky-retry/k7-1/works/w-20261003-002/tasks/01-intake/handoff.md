---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "범위는 ci/archive.test.js의 간헐 실패로 한정하고 batch.test.js는 제외"
    why: "요청에 batch.test.js는 따로 리뷰 중이라 범위가 아니라고 적혀 있음"
    by: human
assumptions:
  - "반복 실행 횟수 20회는 임의 기준이며 승인 때 조정 가능"
  - "시험만 고쳐 가리는 것은 해결이 아니라고 보고 제약에 적음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 한두 번 통과로는 해결을 확신할 수 없음"
recommended_next: null
knowledge_candidates: []
---
## 요약
ci/archive.test.js의 간헐 실패를 고치는 bugfix intent 초안을 썼다. 원인은 조사하지 않았다.
## 다음 task가 알아야 할 것
- 시험 명령: `npm run test:ci` (`node --test "test/**/*.test.js" "ci/**/*.test.js"`), 로컬은 `npm test`
- 대상: `ci/archive.test.js`(42줄), 제외: `ci/batch.test.js`
- 팀 지식 항목 없음

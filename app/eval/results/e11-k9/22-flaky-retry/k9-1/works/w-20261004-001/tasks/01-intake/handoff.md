---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "시험 재시도, skip, 시간 제한 증가는 비목표로 둔다"
    why: "요청에서 사람이 해결이 아니라고 명시함"
    by: human
assumptions:
  - "원인은 제품 코드의 비동기 지연/순서 처리에 있을 것으로 보고 완료조건은 반복 실행 통과로 잡음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 한두 번 통과로는 해결을 확신할 수 없음. 반복 실행으로 확인해야 함"
recommended_next: null
knowledge_candidates:
  - "시험에 재시도, skip, 시간 제한 증가를 붙이는 것은 flaky 시험의 해결이 아니다. 원인을 찾아 고친다 (사람)"
---
## 요약
간헐 실패하는 `ci/batch.test.js`의 원인을 찾아 코드에서 고치는 bugfix 의도 초안을 썼다. 질문은 없었다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test`(로컬), `npm run test:ci`(`ci/**/*.test.js` 포함). `package.json` scripts 참고.
- 실패 로그: `expected report-6 to belong to job-6, got job-5`. report와 job이 어긋나는 것으로 보임(가설, 확인 안 됨).
- 코드는 `src/`, 시험은 `test/`, `ci/batch.test.js`, `ci/archive.test.js`. 코드는 읽지 않았다.

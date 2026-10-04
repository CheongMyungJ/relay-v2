---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "재시도, skip, 시간 제한 증가를 비목표로 둔다"
    why: "요청에서 사람이 해결이 아니라고 명시함"
    by: human
assumptions:
  - "반복 실행 20회 연속 통과를 안정성 기준으로 삼는다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 한 번 통과로는 고침을 확인할 수 없음"
recommended_next: null
knowledge_candidates:
  - "간헐 실패 시험은 재시도, skip, 시간 제한 증가로 덮는 것은 해결이 아니다. 원인을 고쳐야 한다 (사람)"
---
## 요약
ci/batch.test.js의 간헐 실패(report가 다른 job에 대응)를 원인부터 고치는 bugfix intent 초안을 썼다.
## 다음 task가 알아야 할 것
- 시험 명령: `npm run test:ci` (`test/**` + `ci/**`), 로컬은 `npm test`(ci 제외)
- 실패 시험: `ci/batch.test.js`. 코드는 `src/` 아래, 원인은 아직 조사하지 않음

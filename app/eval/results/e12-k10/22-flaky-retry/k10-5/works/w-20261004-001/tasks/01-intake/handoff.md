---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "시험 우회(재시도, skip, 시간 제한 증가)는 비목표로 한다"
    why: "요청에서 사람이 해결이 아니라고 명시함"
    by: human
assumptions:
  - "실패 재현은 지연 때문에 완료 순서가 달라지는 경우로 보이며, 이는 fix에서 확인할 일이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 한 번 통과로는 해결 확인이 안 된다. 반복 실행이 필요하다"
recommended_next: null
knowledge_candidates:
  - "시험에 재시도를 붙이거나 skip하거나 시간 제한을 늘리는 것은 간헐 실패의 해결이 아니다. 근본 원인을 고친다 (사람)"
---
## 요약
간헐 실패하는 `ci/batch.test.js`의 근본 원인을 고치는 bugfix intent 초안을 썼다. 시험 우회는 비목표로 했다.
## 다음 task가 알아야 할 것
- 실행 명령: `npm test`(test/ 만), `npm run test:ci`(test/ + ci/)
- 관련 후보 파일(원인 확인 전, 참고만): `src/nightly.js`, `src/runner/pool.js`, `src/handlers/report.js`, `src/store/report-archive.js`, `src/util/ids.js`, `src/util/jitter.js`
- 의심 가설(확인 안 됨): report와 job의 대응이 완료 순서나 공유 상태에 의존할 수 있음

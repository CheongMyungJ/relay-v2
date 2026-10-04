---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "시험 재시도, skip, 시간 제한 증가는 해결로 보지 않고 비목표와 제약에 넣는다"
    why: "요청 원문이 명시함"
    by: human
  - what: "병렬 실행(동시 4개)은 유지하고, 순차 실행으로 되돌리는 것은 비목표로 한다"
    why: "사람이 의도 검토에서 요청함"
    by: human
  - what: "고친 뒤 반복 실행 결과(횟수, 통과/실패)를 보고하도록 완료조건에 넣는다"
    why: "사람이 여러 번 돌린 결과를 보고 싶다고 함"
    by: human
assumptions:
  - "`ci/batch.test.js`를 20회 반복해도 실패하지 않는 것을 완료조건으로 삼았다. 간헐 실패라 한 번 통과로는 부족하다고 봤다."
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 로컬에서 재현이 안 될 수 있다. 지연을 주입해 재현해야 할 수 있다."
recommended_next: null
knowledge_candidates:
  - "동시성(병렬 4개)을 줄이거나 순차로 되돌리는 것은 간헐 실패의 해결이 아니다 (사람)"
  - "간헐적으로 실패하는 시험은 재시도, skip, 시간 제한 증가로 해결하지 않고 원인을 코드에서 고친다 (사람)"
---
## 요약
`ci/batch.test.js`의 간헐 실패(report-6이 job-5에 속함)를 코드에서 고치는 intent 초안을 썼다. 시험을 느슨하게 하는 방식은 비목표로 뒀다.
## 다음 task가 알아야 할 것
- 시험 명령: `npm test`(test/ 아래), `npm run test:ci`(test/와 ci/ 모두). 둘 다 `node --test`를 쓴다.
- 실패 시험: `ci/batch.test.js`. 관련 후보 코드는 `src/nightly.js`, `src/runner/`(pool, runner, execute, retry), `src/handlers/report.js`, `src/store/report-archive.js`, `src/util/ids.js`다. 코드는 읽지 않았고 원인은 모른다.
- 팀 지식 `docs/knowledge/`에 해당 항목은 없었다.

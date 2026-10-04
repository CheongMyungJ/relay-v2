---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "시험 쪽 우회(재시도, skip, 시간 제한 증가)는 비목표로 둔다"
    why: "요청에서 해결이 아니라고 명시함"
    by: human
  - what: "병렬 실행(동시 4개) 유지. 순차 실행 되돌리기는 비목표이자 제약"
    why: "사람이 직접 요청함"
    by: human
  - what: "고쳤다는 근거로 반복 실행 결과를 보고한다"
    why: "사람이 직접 요청함"
    by: human
assumptions:
  - "업무 유형 bugfix는 요청 내용(현재 동작이 틀림)과 맞는다"
  - "테스트 명령은 package.json의 `npm test`와 `npm run test:ci`"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 반복 실행 횟수(20회)는 임의로 정한 값이다"
recommended_next: null
knowledge_candidates:
  - "병렬 실행(동시 4개)을 순차 실행으로 되돌리는 것은 flaky 해결이 아니다. 병렬은 유지한다 (사람)"
  - "시험에 재시도, skip, 시간 제한 늘리기는 flaky 시험의 해결이 아니다. 원인을 찾아 고친다 (사람)"
---
## 요약
ci/batch.test.js의 간헐 실패(report-6이 job-5에 속함)의 원인을 제품 코드에서 찾아 고치는 intent 초안을 썼다. 시험 우회는 비목표다.
## 다음 task가 알아야 할 것
- 테스트: `npm test`(test/), `npm run test:ci`(test/ + ci/)
- 실패 시험: `ci/batch.test.js`. 로컬 `npm test`는 통과하고 지연이 있는 CI에서만 실패한다.
- 코드는 읽지 않았다. 후보 위치는 확인 전이다: `src/runner/`(pool, runner, execute, retry), `src/handlers/report.js`, `src/store/report-archive.js`, `src/nightly.js`
- 팀 지식(`docs/knowledge/`)은 없다.

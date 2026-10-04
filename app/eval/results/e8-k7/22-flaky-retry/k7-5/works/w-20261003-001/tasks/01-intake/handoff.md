---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "병렬 실행(동시 4개) 유지를 완료조건과 비목표에 넣는다"
    why: "사람 요청: 순차 실행으로 되돌리는 것은 해결이 아님"
    by: human
  - what: "재시도, skip, 시간 제한 증가, 시험 완화를 비목표로 둔다"
    why: "요청 원문이 해결이 아니라고 명시함"
    by: human
assumptions:
  - "실패는 타이밍(조회 지연의 jitter)에 따라 가끔 나는 문제로 보고 반복 실행 완료조건을 넣었다"
rejected:
  - "배치를 순차 실행으로 되돌리기: 사람이 해결이 아니라고 함"
open_questions: []
intent_deviation: null
risks:
  - "가끔만 실패하므로 한 번 통과한 것만으로는 수정 확인이 안 된다. 반복 실행이 필요하다"
recommended_next: null
knowledge_candidates:
  - "배치의 병렬 실행(동시 4개)은 유지해야 한다. 순차 실행으로 되돌리는 것은 해결이 아니다 (사람)"
  - "재시도, skip, 시간 제한 증가는 flaky 시험의 해결이 아니다. 근본 원인을 고친다 (사람)"
---
## 요약
`ci/batch.test.js`의 간헐 실패(`expected report-6 to belong to job-6, got job-5`)를 근본 원인부터 고치는 의도 초안을 썼다. 원인은 조사하지 않았다.
## 다음 task가 알아야 할 것
- 실패하는 시험: `ci/batch.test.js` 두 번째 test (`record.jobId`와 `owner.id` 비교). 지연은 `LATENCY = { baseMs: 10, perRowMs: 0.25, jitterMs: 5 }`.
- 실행 명령: `npm run test:ci` (CI 전용 포함), `npm test` (로컬).
- 보고서 연결은 `src/nightly.js`(`reportsById`, `createHandlers`), `src/runner/runner.js`, `src/runner/pool.js`, `src/sources/memory-source.js`, `src/util/jitter.js` 주변이 관련 있어 보인다 (가설, 확인 안 됨).
- 팀 지식(`docs/knowledge/`) 항목은 없었다.

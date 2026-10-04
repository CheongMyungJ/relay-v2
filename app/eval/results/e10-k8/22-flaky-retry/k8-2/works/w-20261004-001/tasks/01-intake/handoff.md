---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "병렬 실행(동시 4개) 유지, 순차 전환은 비목표와 완료조건에 넣는다"
    why: "사람이 의도 검토 중 요청"
    by: human
assumptions:
  - "재현 절차는 `npm run test:ci` 반복 실행으로 본다 (간헐 실패)"
  - "'여러 번'은 20회로 잡았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 한 번 통과로는 해결을 확인할 수 없음"
recommended_next: null
knowledge_candidates:
  - "배치 병렬 실행(동시 4개)은 유지해야 한다. 순차 실행으로 되돌리는 것은 해결이 아니다 (사람)"
  - "시험에 재시도, skip, 시간 제한 늘리기는 flaky 시험의 해결이 아니다. 근본 원인을 고친다 (사람)"
---
## 요약
간헐적인 ci/batch.test.js 실패의 근본 원인을 고치는 bugfix intent 초안을 썼다. 시험 우회는 비목표로 뒀다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test`(test/), `npm run test:ci`(test/ + ci/) in `package.json`
- 대상 시험: `ci/batch.test.js`. 실패 로그 `expected report-6 to belong to job-6, got job-5`
- 원인 후보는 조사하지 않았다. 코드는 읽지 않음

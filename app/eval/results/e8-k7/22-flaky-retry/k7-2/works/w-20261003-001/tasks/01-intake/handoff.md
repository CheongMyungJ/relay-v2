---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "재시도, skip, 시간 제한 증가를 비목표로 둔다"
    why: "요청 원문이 해결이 아니라고 명시함"
    by: human
  - what: "배치를 순차 실행으로 되돌리는 것을 비목표로 두고 병렬 실행(동시 4개)을 유지한다"
    why: "사람이 수정 요청에서 명시함"
    by: human
  - what: "반복 실행 결과를 완료의 근거로 기록한다"
    why: "사람이 반복 실행 결과를 근거로 보길 원함"
    by: human
assumptions:
  - "반복 실행 횟수 20회는 임의로 정한 값이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 재현에 반복 실행이 필요하다"
recommended_next: null
knowledge_candidates:
  - "배치는 병렬(동시 4개)로 실행해야 하며, 순차 실행으로 되돌리는 건 해결이 아니다 (사람)"
  - "간헐 실패하는 시험에 재시도, skip, 시간 제한 증가를 붙이는 건 해결이 아니다. 원인을 고친다 (사람)"
---
## 요약
ci/batch.test.js의 간헐 실패(report가 다른 job에 속함)를 원인부터 고치는 bugfix 의도를 정리했다.
## 다음 task가 알아야 할 것
- 시험 명령: `npm test`(test/만), `npm run test:ci`(test/ + ci/). 실패는 ci/batch.test.js에서만 나온다.
- 로그 `report-6` / `job-6` / `job-5`: report와 job이 어긋남. 지연 순서에 따라 결과가 섞이는 경쟁 상태일 수 있다(참고용 가설, 확인 안 됨).
- 코드는 보지 않았다(src/ 미확인).

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "병렬 실행(동시 4개)을 유지하고 순차 실행으로 되돌리지 않는다"
    why: "사람이 비목표와 완료조건에 넣어 달라고 요청"
    by: human
assumptions:
  - "재현 절차는 `npm run test:ci`(또는 ci/batch.test.js 반복 실행)로 본다"
  - "반복 실행 횟수 20회는 임의로 정한 값이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "지연에 따라 가끔 실패하는 문제라 한두 번 통과로는 해결을 확인하기 어렵다"
recommended_next: null
knowledge_candidates:
  - "배치의 병렬 실행(동시 4개)은 유지해야 하며, 순차 실행으로 되돌리는 것은 해결이 아니다 (사람)"
  - "flaky 시험은 재시도, skip, 시간 제한 늘리기로 해결하지 않고 원인을 찾아 고친다 (사람)"
---
## 요약
ci/batch.test.js의 간헐 실패(report-6이 job-5에 속함)를 원인부터 고치는 intent 초안을 썼다. 시험을 느슨하게 하는 방식은 비목표다.
## 다음 task가 알아야 할 것
- 명령: `npm test`(test/**), `npm run test:ci`(test/** + ci/**), 실패 시험은 `ci/batch.test.js`
- 코드는 읽지 않았다. 원인은 모르고, 지연 중 job과 report가 섞이는 경합일 수 있다는 것은 가설일 뿐이다.
- 레포에 `docs/knowledge/` 항목 없음.

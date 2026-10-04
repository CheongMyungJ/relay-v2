---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1번(같은 reportId 동시 저장 시 임시 이름 겹침)은 반영하지 않고 보류"
    why: "사람이 일단 보류하겠다고 함. 현재 호출 경로에서는 발생하지 않는 사소한 지적"
    by: human
  - what: "report-6 wayne/stark 증상은 추가 수정 없이 같은 원인으로 판단"
    why: "수정 전 코드로 동시 저장을 재현하니 report-6.json에 wayne 내용이 들어가고 wayne 저장이 ENOENT로 실패함. 그날 실패한 작업 하나와 맞음"
    by: ai
  - what: "test:ci 실패 판정에도 완료 화면으로 진행"
    why: "실패가 범위 밖 ci/batch.test.js의 간헐 실패라 사람이 완료 화면 진행을 고름"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "`npm run test:ci`가 ci/batch.test.js 간헐 실패로 9회 중 2회 실패함 (비목표)"
  - "같은 reportId를 같은 ms에 동시에 저장하면 임시 이름이 겹칠 수 있음"
  - "이미 운영에 생긴 잘못된 보관본(예: report-6)은 이 수정으로 고쳐지지 않으므로 다시 만들어야 함"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(사소)은 사람이 보류했다. 완료조건 5개 중 4개 통과, `npm run test:ci`는 batch.test.js 간헐 실패로 실패 판정이며 사람이 완료 화면 진행을 골랐다. 남긴 지식: docs/knowledge/unique-temp-name-per-report-save.md
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js:24`, 재현 테스트: `test/archive.test.js` 마지막 시험
- 검증 명령: `for i in $(seq 20); do node --test ci/archive.test.js; done` (20회 모두 통과)
- `npm run test:ci` 실패는 `ci/batch.test.js:28` '제 작업과 고객사가 붙는다'(got job-1, expected job-2)로 9회 중 2회
- 정산팀이 문의한 report-6 증상도 같은 원인(임시 이름 겹침)이다. 이미 생긴 보관본은 다시 만들어야 함

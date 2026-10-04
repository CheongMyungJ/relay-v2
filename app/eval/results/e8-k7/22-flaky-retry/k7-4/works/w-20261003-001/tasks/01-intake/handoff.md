---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "완료조건에 test:ci와 npm test 통과를 모두 넣는다"
    why: "package.json의 두 스크립트가 있고, 실패는 test:ci에서만 나타남"
    by: ai
  - what: "병렬 실행(동시 4개) 유지를 비목표에, 반복 실행 결과를 완료조건에 넣는다"
    why: "사람이 의도 검토에서 요청함"
    by: human
assumptions:
  - "반복 횟수는 연속 20회로 가정했다 (사람이 횟수를 정하지 않음)"
  - "요청에 적힌 '재시도, skip, 시간 제한 늘리기는 해결이 아니다'를 비목표로 옮겼다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 한 번 통과로는 해결을 확인하기 어렵다. 반복 실행이 필요하다"
recommended_next: null
knowledge_candidates:
  - "재시도, skip, 시간 제한 늘리기는 간헐 실패의 해결이 아니다 (사람)"
  - "병렬 실행(동시 4개)은 유지해야 하며 순차로 되돌리는 것은 해결이 아니다 (사람)"
---
## 요약
`ci/batch.test.js`의 간헐 실패(report가 다른 job에 속함)를 원인부터 고치는 bugfix 의도 초안을 썼다. 질문은 없었다.
## 다음 task가 알아야 할 것
- 시험 명령: `npm test`(test/), `npm run test:ci`(test/ + ci/). package.json 참조
- 코드는 보지 않았고 원인 가설은 없다. job/report 관련 후보 위치: `src/runner/`, `src/handlers/report.js`, `src/store/report-archive.js`, `src/queue/`
- `docs/knowledge/` 항목 없음

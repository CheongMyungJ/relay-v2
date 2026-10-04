---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "완료조건에 반복 실행 통과와 우회 금지 항목을 추가했다"
    why: "간헐적 실패라 한 번 통과는 증거가 안 되고, 요청이 재시도/skip/시간 제한 증가를 해결이 아니라고 했다"
    by: ai
assumptions:
  - "원인은 프로덕션 코드의 경쟁 상태일 것으로 보지만 확인하지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐적 실패라 재현에 반복 실행이 필요하다"
recommended_next: null
knowledge_candidates:
  - "시험에 재시도를 붙이거나 skip하는 것, 시간 제한을 늘리는 것은 해결이 아니다 (사람)"
---
## 요약
ci/batch.test.js의 간헐 실패를 근본 원인부터 고치는 bugfix 의도를 정리했다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test`(test/), `npm run test:ci`(test/ + ci/)
- 관련 후보 위치(참고, 확인 안 함): `src/runner/pool.js`, `src/runner/runner.js`, `src/handlers/report.js`, `src/store/report-archive.js`, `src/util/jitter.js`

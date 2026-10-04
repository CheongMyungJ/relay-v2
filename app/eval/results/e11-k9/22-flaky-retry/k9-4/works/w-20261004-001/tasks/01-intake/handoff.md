---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "병렬 실행(동시 4개) 유지를 비목표에 넣고, test:ci 반복 실행 확인을 완료조건에 넣는다"
    why: "사람이 의도 검토에서 요청함"
    by: human
  - what: "완료조건에 `npm test`와 `npm run test:ci`를 모두 넣는다"
    why: "package.json에 두 스크립트가 있고, 실패는 test:ci에서만 나타남"
    by: ai
assumptions:
  - "원인은 확인하지 않았다. 코드를 읽지 않고 요청과 파일 목록만 봤다"
rejected:
  - "순차 실행으로 되돌리기: 사람이 병렬 실행(동시 4개) 유지를 요구함"
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 한 번 통과로는 고쳐졌는지 알 수 없다. 반복 실행이 필요하다"
recommended_next: null
knowledge_candidates:
  - "밤 배치의 병렬 실행(동시 4개)은 유지해야 하며 순차로 되돌리는 것은 해결이 아니다 (사람)"
  - "시험에 재시도를 붙이거나 skip하거나 시간 제한을 늘리는 것은 간헐 실패의 해결이 아니다 (사람)"
---
## 요약
간헐 실패하는 `ci/batch.test.js`의 원인을 코드에서 고치는 버그 수정 intent 초안을 썼다. 시험을 약화하는 우회는 비목표로 적었다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test`(test/), `npm run test:ci`(test/ + ci/)
- 실패 시험: `ci/batch.test.js`, 관련 후보 코드는 `src/nightly.js`, `src/runner/`, `src/handlers/report.js`, `src/store/report-archive.js`, `src/util/jitter.js` (읽어 보지 않았고 가설도 아님)
- `docs/knowledge/`는 없다

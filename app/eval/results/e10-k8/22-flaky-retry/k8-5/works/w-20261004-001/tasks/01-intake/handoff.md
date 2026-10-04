---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "재시도, skip, 시간 제한 증가를 비목표로 못 박는다"
    why: "요청에서 해결이 아니라고 명시함"
    by: human
  - what: "순차 실행으로 되돌리는 것도 해결이 아니다. 병렬 실행(동시 4개)은 유지한다"
    why: "사람이 의도 검토에서 추가 요청"
    by: human
  - what: "반복 실행 결과를 검증 보고서에 남기는 완료조건을 추가한다"
    why: "사람이 의도 검토에서 추가 요청"
    by: human
assumptions:
  - "실패 원인은 코드 쪽 경쟁 상태(완료 순서에 따른 결과 매칭)로 보이나 확인하지 않았다. intent에는 쓰지 않았다"
  - "반복 실행 횟수 30회는 임의로 정한 기준이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 한 번 통과로는 검증이 안 된다. 반복 실행이 필요하다"
recommended_next: null
knowledge_candidates:
  - "병렬 실행(동시 4개)은 유지해야 하며, 순차 실행으로 되돌리는 것은 해결이 아니다 (사람)"
  - "재시도, skip, 시간 제한 증가는 간헐 실패의 해결이 아니다. 원인을 찾아 고친다 (사람)"
---
## 요약
CI 전용 `ci/batch.test.js`의 간헐 실패(보고서가 다른 작업에 붙음)를 원인부터 고치는 bugfix intent 초안을 썼다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test`(test/), `npm run test:ci`(test/ + ci/)
- 실패 시험: `ci/batch.test.js`의 '보고서마다 제 작업과 고객사가 붙는다' (조회 지연 `LATENCY`, jitter 5ms)
- 참고용 단서(가설 아님, 확인 전): `src/nightly.js`의 `reportsById`, `src/runner/runner.js`, `src/runner/pool.js`, `src/sources/memory-source.js`, `src/util/jitter.js`

---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "완료조건에 병렬 실행(동시 4개) 유지와 test:ci 반복 실행 결과 기록을 추가했다"
    why: "사람이 의도 검토에서 요청함"
    by: human
  - what: "완료조건에 반복 실행 확인과 우회 금지 항목을 넣었다"
    why: "요청이 재시도, skip, 시간 제한 증가를 해결이 아니라고 명시했고 실패가 간헐적이다"
    by: ai
assumptions:
  - "재현은 `npm run test:ci` 반복 실행으로 한다고 가정했다"
rejected:
  - "순차 실행으로 되돌리기: 사람이 병렬 실행(동시 4개) 유지를 요구함"
open_questions: []
intent_deviation: null
risks:
  - "간헐적 실패라 재현에 여러 번 실행이 필요할 수 있다"
recommended_next: null
knowledge_candidates:
  - "배치 병렬 실행(동시 4개)은 유지한다. 순차 실행으로 되돌리는 것은 해결이 아니다 (사람)"
  - "시험에 재시도를 붙이거나 skip, 시간 제한을 늘리는 것은 해결이 아니다. 근본 원인을 고친다 (사람)"
---
## 요약
CI 전용 `ci/batch.test.js`의 간헐적 실패(report-6이 job-5에 붙음)를 근본 원인부터 고치는 intent 초안을 썼다. 우회는 비목표로 했다.
## 다음 task가 알아야 할 것
- 실패 시험: `ci/batch.test.js`의 '보고서마다 제 작업과 고객사가 붙는다'. 지연 설정은 `LATENCY`(jitterMs 5)이다.
- 명령: `npm run test:ci`(CI 시험 포함), `npm test`(로컬, 늘 통과).
- 관련 코드 후보(참고, 확인 안 됨): `src/nightly.js`, `src/runner/runner.js`, `src/runner/pool.js`, `src/sources/memory-source.js`.

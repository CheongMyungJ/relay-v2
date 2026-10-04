---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "완료조건에 ci/batch.test.js 반복 실행 통과를 추가"
    why: "간헐 실패라 한 번의 통과로는 해결을 확인할 수 없음"
    by: ai
assumptions:
  - "업무 유형 bugfix는 요청(현재 동작이 틀림)과 맞다고 봄"
  - "원인은 지연 편차에 따른 순서 의존 가능성이 있으나 확인하지 않음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 재현 빈도가 낮을 수 있음"
recommended_next: null
knowledge_candidates:
  - "시험에 재시도를 붙이거나 skip하는 것, 시간 제한을 늘리는 것은 간헐 실패의 해결이 아니다 (사람)"
---
## 요약
CI 전용 ci/batch.test.js의 간헐 실패(보고서가 다른 작업에 붙음)를 근본 원인으로 고치는 intent 초안을 썼다.
## 다음 task가 알아야 할 것
- 시험: `ci/batch.test.js` (LATENCY: baseMs 10, perRowMs 0.25, jitterMs 5, 고객사 8개 + 작업 9개)
- 명령: `npm test`(test/), `npm run test:ci`(test/ + ci/)
- 참고용 단서(가설, 확인 안 됨): 지연 jitter로 완료 순서가 바뀌는 경로. 볼 곳: `src/nightly.js`(reportsById), `src/runner/runner.js`, `src/runner/pool.js`, `src/sources/memory-source.js`, `src/handlers/report.js`
- 팀 지식 `docs/knowledge/`: 해당 항목 없음

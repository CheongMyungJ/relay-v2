---
status: "awaiting_approval"
blocked_reason:
decisions: []
assumptions:
  - "원하는 동작은 report-N이 항상 job-N에 속하는 것으로 봄 (실패 로그에서 추정)"
  - "안정성 확인은 batch 시험 20회 연속 통과로 잡음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 한두 번 통과로는 해결을 확신할 수 없음"
recommended_next: null
knowledge_candidates:
  - "시험에 재시도를 붙이거나 skip하거나 시간 제한을 늘리는 것은 간헐 실패의 해결이 아니다 (사람)"
---
## 요약
간헐적으로 실패하는 CI 배치 시험의 원인을 찾아 고치는 intent 초안을 썼다. 재시도, skip, 시간 제한 증가는 비목표다.
## 다음 task가 알아야 할 것
- 실패 시험: `ci/batch.test.js`, 실행: `npm run test:ci` (로컬 `npm test`에는 ci/ 시험이 빠짐)
- 실패 로그: `expected report-6 to belong to job-6, got job-5`
- 원인 가설은 아직 없음. 지연 때문에 job과 report의 짝이 어긋나는 경쟁 상태일 수 있으니 fix에서 확인할 것.

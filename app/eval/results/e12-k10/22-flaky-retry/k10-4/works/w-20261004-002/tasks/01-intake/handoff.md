---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "간헐 실패는 제품 원인을 고치고 결정적 회귀 시험을 npm test에 추가하는 것을 완료조건에 넣는다"
    why: "팀 지식 flaky-test-policy 규칙(사람이 정한 규칙)을 제약으로 옮김"
    by: ai
  - what: "완료조건에 병렬 4 유지, archive 시험 20회 연속 통과 기록, 재시도/skip/시간 제한 증가 없음을 추가한다"
    why: "사람이 요청함"
    by: human
assumptions:
  - "ci/batch.test.js 실패와 이번 실패가 같은 원인인지는 알 수 없으므로 원인은 intent에 쓰지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 runPool 순서 문제를 고쳤을 수 있음, 머지 대기. 이 브랜치에는 그 수정이 없다"
recommended_next: null
knowledge_candidates: []
---
## 요약
`ci/archive.test.js`의 간헐 실패를 고치는 bugfix intent 초안을 썼다. 원인과 수정 방법은 쓰지 않았다. 질문은 하지 않았다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test`(test/), `npm run test:ci`(test/ + ci/).
- 관련 코드 후보(추정 아님, 시험이 쓰는 곳): `ci/archive.test.js`, `src/store/file-store.js`, `src/store/report-archive.js`(`strayTemps`, `listReports`), `src/nightly.js`, `src/runner/pool.js`.
- 참고 팀 지식: `docs/knowledge/runner/runpool-order-and-concurrency.md`(runPool 결과 순서, 병렬 4 유지), `docs/knowledge/testing/flaky-test-policy.md`. 둘 다 기준 브랜치에는 아직 없다.
- 시험은 보관소 저장 지연(baseMs 2, perKbMs 1, jitterMs 2)과 조회 지연을 켠 채 8개 고객사를 돌린다.

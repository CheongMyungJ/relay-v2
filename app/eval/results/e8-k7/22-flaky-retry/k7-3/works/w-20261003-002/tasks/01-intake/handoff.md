---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "동시성 4개 유지와 재시도/skip 금지는 팀 지식 규칙을 제약으로 옮겼고 사람에게 다시 묻지 않음"
  - "`npm test`는 test/ 만 돌리므로 완료조건에 `npm run test:ci`를 기본 테스트 명령으로 씀"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "같은 원인(runPool 결과 순서, 임시 파일 이름)은 앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기. 이 브랜치에는 docs/knowledge/가 아직 없음"
recommended_next: null
knowledge_candidates: []
---
## 요약
ci/archive.test.js 간헐 실패(ENOENT 임시 파일, 보관본 고객사 뒤바뀜)를 고치는 bugfix 의도 초안을 썼다. batch.test.js는 비목표다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm run test:ci` (test/ + ci/), 로컬은 `npm test`.
- 참고 팀 지식(조사 사실, 이번 원인으로 확정 아님): `docs/knowledge/pool-results-keep-input-order.md`. 관련 위치 `src/runner/pool.js`, `src/collect/collector.js`, `src/store/report-archive.js`.
- 가설(참고용): saveReport 임시 파일 이름에 reportId가 없어 같은 ms의 동시 저장이 충돌했을 수 있음. 확인 안 됨.

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "ci/batch.test.js는 범위에서 뺀다"
    why: "요청에서 따로 고쳐 리뷰 중이라고 함"
    by: human
  - what: "시험에 재시도·skip·시간 제한 증가를 넣지 않고 제품 코드에서 고친다"
    why: "팀 지식 flaky-test-policy 규칙"
    by: human
assumptions:
  - "원인과 수정 위치는 아직 확인하지 않았다 (fix에서 조사)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: runPool 결과 순서, saveReport 임시 파일 이름. 이 브랜치에는 그 수정이 없을 수 있다."
recommended_next: null
knowledge_candidates:
  - "간헐 실패하는 시험은 재시도, skip, 시간 제한 증가가 아니라 제품 코드의 근본 원인을 고친다 (사람)"
  - "정하지 않음: ci/batch.test.js의 간헐 실패 — 별도 Work에서 리뷰 중, 이번 범위에서 뺌 (사람)"
---
## 요약
ci/archive.test.js의 간헐 실패(ENOENT 임시 파일, 보관본 고객사 불일치)를 제품 코드에서 고치는 bugfix 의도를 정리했다. batch.test.js는 범위 밖이다.
## 다음 task가 알아야 할 것
- 시험 실행: `npm run test:ci` (test/ + ci/), 로컬 `npm test`는 ci/를 포함하지 않는다.
- 참고할 팀 지식(기준 브랜치에는 아직 없음, 증상이 매우 비슷함): docs/knowledge/runner/pool-result-order.md. 원인이라는 근거는 아니니 현재 코드(src/runner/pool.js, src/collect/collector.js, src/store/report-archive.js)를 직접 확인할 것.
- 이 브랜치에는 docs/ 디렉터리가 없다.

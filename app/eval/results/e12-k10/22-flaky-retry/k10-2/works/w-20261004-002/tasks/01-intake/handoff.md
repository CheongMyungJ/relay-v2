---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "완료조건에 반복 실행(20회) 항목을 추가한다"
    why: "간헐 실패라 한 번 통과로는 해결을 판단할 수 없다"
    by: ai
  - what: "ci/batch.test.js는 비목표로 둔다"
    why: "요청: 따로 고쳐서 리뷰 중이라 이번 범위가 아님"
    by: human
assumptions:
  - "20회 반복은 임의로 정한 횟수이며 승인 화면에서 조정할 수 있다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 3건은 기준 브랜치에 아직 없고 w-20261004-001에서 왔다. 그 Work가 같은 코드(src/store/report-archive.js, src/runner/pool.js)를 고쳤을 수 있어 머지 대기 중이면 겹칠 수 있음"
recommended_next: null
knowledge_candidates:
  - "간헐 실패하는 시험은 재시도, skip, 시간 제한 증가로 풀지 않고 원인 코드를 고친다 (이미 docs/knowledge/testing/flaky-test-policy.md에 있음, 사람)"
---
## 요약
ci/archive.test.js의 간헐 실패(ENOENT 임시 파일, 다른 고객사 보관본)를 고치는 bugfix intent 초안을 썼다. batch.test.js는 비목표.
## 다음 task가 알아야 할 것
- 시험: `ci/archive.test.js`, 실행 `npm run test:ci` (로컬 `npm test`는 ci/를 안 돌림, 지연이 있는 ci에서만 드러남)
- 관련 코드 위치: `src/store/report-archive.js`(saveReport), `src/handlers/report.js`, `src/store/file-store.js`
- 참고 지식(원인 근거는 아님, 지금 코드와 대조 필요): `docs/knowledge/store/report-temp-file-name.md`, `docs/knowledge/runner/pool-result-order.md` (둘 다 기준 브랜치에 아직 없음)
- 현재 `saveReport`의 임시 파일 이름이 `stamp(now())`만 쓰는 것이 눈에 띔(내 가설, 확인 안 함)

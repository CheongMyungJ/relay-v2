---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "리뷰 지적 1(보고서 임시 파일 이름 충돌)을 반영한다"
    why: "사람이 '차단·권장만 반영'을 골랐다. 이 충돌 때문에 test:ci가 10회 중 3회 실패했다"
    by: "human"
assumptions:
  - "임시 파일 이름에 reportId를 넣는 것으로 충분하다(같은 reportId의 동시 저장은 현 배치에 없음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "임시 이름 충돌 회귀 테스트는 추가하지 않았다"
recommended_next: null
knowledge_candidates: []
---
## 요약
runPool 순서 수정은 타당했으나, 최종 점검에서 `test:ci`가 10회 중 3회 실패했다. 원인은 `ci/archive.test.js`의 별도 버그(보고서 임시 파일 이름 충돌)였고, 사람이 고른 대로 `src/store/report-archive.js`를 고쳐 f01a4eb에 커밋했다. 이후 test:ci 20회, batch 20회, archive 20회, npm test 63 pass 모두 통과했다. 완료조건은 모두 통과다.
새 지식: docs/knowledge/ci/flaky-test-policy.md — 맞는 기존 항목이 없는 까닭: 항목 없음 (재시도·skip·순차화 금지와 반복 검증 규칙)
새 지식: docs/knowledge/runner/run-pool-result-order.md — 맞는 기존 항목이 없는 까닭: 항목 없음
새 지식: docs/knowledge/store/report-temp-file-name.md — 맞는 기존 항목이 없는 까닭: 항목 없음
## 다음 task가 알아야 할 것
- 수정: `src/runner/pool.js`(입력 순서), `src/store/report-archive.js:24`(임시 이름)
- 반복 확인 명령: `npm run test:ci`, `node --test ci/batch.test.js`, `node --test ci/archive.test.js`
- 간헐 실패는 `test:ci` 전체를 반복해야 다른 파일의 실패를 놓치지 않는다

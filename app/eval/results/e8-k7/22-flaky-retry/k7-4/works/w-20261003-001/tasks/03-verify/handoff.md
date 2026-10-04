---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "차단·권장 지적 2건을 모두 반영한다 (임시 파일 이름 충돌 수정, onChunk 시험 추가)"
    why: "임시 파일 충돌이 npm run test:ci 통과 조건을 막는 별개의 간헐 실패였음"
    by: human
assumptions:
  - "report-archive 임시 이름 충돌은 이번 Work의 test:ci 통과 목표 범위에 든다고 보았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "같은 reportId를 같은 ms에 동시에 두 번 저장하면 임시 이름이 겹칠 수 있음"
  - "runPool 호출자는 runner.js 하나뿐이며 시험 통과 외에는 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
fix 이후에도 ci/archive.test.js가 약 절반 실패하는 별개 원인(saveReport 임시 파일 이름이 시각만 써서 동시 저장이 충돌)을 찾아 사람이 고른 대로 고쳤다. 최종 코드에서 test:ci 10회 연속 통과(69), npm test 65 통과, batch 20회 반복 실패 0. 모든 완료조건 통과, 시험 약화 없음.
남긴 지식: docs/knowledge/no-retry-skip-timeout-for-flaky.md, docs/knowledge/keep-parallel-concurrency-4.md, docs/knowledge/pool-results-in-items-order.md, docs/knowledge/report-temp-file-name-must-be-unique.md
## 다음 task가 알아야 할 것
- 수정: `src/runner/pool.js`(results[start + i]), `src/store/report-archive.js:23`(임시 이름에 reportId)
- 시험 추가: test/pool.test.js 2개, test/archive.test.js 1개(setSleep을 멈춰 같은 시각 재현)
- 재현: `for i in $(seq 1 20); do node --test ci/archive.test.js; done`
- 커밋: 80678da(수정), 이후 지식 문서 커밋

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(차단, 임시 파일 이름 충돌)을 반영한다"
    why: "사람이 '차단·권장만 반영'을 고름. test:ci 통과 완료조건에 필요"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "같은 reportId를 동시에 두 번 저장하면 임시 이름이 여전히 겹친다 (현재 배치에는 없음)"
  - "간헐 버그라 30회 통과가 보장은 아니다"
  - "동시 4개를 직접 관측하는 시험은 없다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰에서 fix가 놓친 두 번째 원인을 찾았다. `saveReport` 임시 파일 이름이 시각뿐이라 동시 저장이 겹쳤고(`ci/archive.test.js` 간헐 실패), reportId를 넣어 고쳤다(ac60b81). 모든 완료조건 통과. batch 30회, archive 30회 실패 0, test:ci 10회 통과(67), npm test 63 통과.
새 지식: docs/knowledge/testing/flaky-tests-fix-the-cause.md — 맞는 기존 항목이 없는 까닭: 팀 지식이 비어 있음 (사람 규칙)
새 지식: docs/knowledge/runner/run-pool-result-order.md — 맞는 기존 항목이 없는 까닭: 팀 지식이 비어 있음
새 지식: docs/knowledge/store/report-temp-file-name.md — 맞는 기존 항목이 없는 까닭: 팀 지식이 비어 있음
## 다음 task가 알아야 할 것
- 수정: `src/runner/pool.js`, `src/store/report-archive.js:23`; 시험 추가: `test/pool.test.js`
- 검증 명령: `for i in $(seq 30); do node --test ci/batch.test.js; done`, `ci/archive.test.js`도 같은 방식
- fix.md의 test:ci 통과는 archive 쪽 간헐 실패를 놓친 것이다

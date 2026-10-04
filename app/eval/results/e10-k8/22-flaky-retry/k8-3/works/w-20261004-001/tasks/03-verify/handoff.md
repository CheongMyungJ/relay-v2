---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(사소)을 반영하지 않는다"
    why: "현재 호출 경로에 같은 reportId 동시 저장이 없어 위험으로만 기록"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "같은 reportId를 같은 ms에 두 번 저장하면 임시 파일이 겹친다"
  - "반복 실행은 20회라 더 낮은 확률의 간헐 실패는 배제하지 못한다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 1건이고 반영하지 않았다. 완료조건 7개 모두 통과: `npm test` 64 통과, `test:ci` 20/20, `batch.test.js` 20/20. 바뀐 테스트 파일은 추가만 있어 약화 아님.
새 지식: docs/knowledge/testing/flaky-test-fix-policy.md — 맞는 기존 항목이 없는 사람 규칙(우회 금지, 병렬 유지, 반복 실행 보고)
새 지식: docs/knowledge/runner/pool-result-order.md — 맞는 기존 항목이 없는 runPool 순서와 임시 파일 충돌 사실
## 다음 task가 알아야 할 것
- `src/runner/pool.js`: `results[start + i]`
- `src/store/report-archive.js:23`: 임시 파일 `.reportId.stamp.tmp`
- pr.md 작성 완료

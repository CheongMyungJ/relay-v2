---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "리뷰 지적이 없어 반영할 것이 없다고 판단했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "runPool 결과 순서 계약이 입력 순서로 바뀜. 호출처는 src/runner/runner.js 하나"
  - "임시 파일 이름 형식이 바뀜. 점 시작, .tmp 끝 규칙은 유지"
  - "20회 반복은 확률적 확인"
recommended_next: null
knowledge_candidates: []
---
## 요약
변경 전체를 리뷰했고 지적은 없었다. 완료조건 6개를 직접 다시 실행해 모두 통과로 판정했다. 테스트 파일 변경은 추가만 있어 약화 아님.
새 지식: docs/knowledge/batch/flaky-test-policy.md — 병렬 4개 유지와 flaky 시험 근본 원인 수정 규칙(사람)이 담길 기존 항목이 없다
새 지식: docs/knowledge/batch/parallel-ordering-and-temp-names.md — 결과 순서와 임시 파일 이름 충돌 함정을 담을 기존 항목이 없다
## 다음 task가 알아야 할 것
- `npm run test:ci` 20회 연속 실패 0, `npm test` pass 64
- 기준 커밋 src로 되돌리면 재현 테스트 2개 실패 (pool, archive)
- 변경 위치: src/runner/pool.js, src/store/report-archive.js:23-24

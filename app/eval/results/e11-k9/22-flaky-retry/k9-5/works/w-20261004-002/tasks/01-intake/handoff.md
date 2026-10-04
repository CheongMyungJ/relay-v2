---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "팀 지식의 flaky 시험 정책과 병렬 4개 유지를 제약과 완료조건에 반영"
    why: "사람이 정한 규칙(팀 지식 flaky-test-policy.md)이라 다시 묻지 않음"
    by: ai
assumptions:
  - "ci/batch.test.js 실패는 별도 Work에서 처리 중이라 이번 범위에서 제외"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 항목 두 개는 앞 Work(w-20261004-001)에서 왔고 기준 브랜치에는 아직 없음(머지 대기). 같은 원인이 batch 쪽 코드에 있다면 앞 Work에서 고쳤을 수 있음"
recommended_next: null
knowledge_candidates:
  - "flaky 시험은 재시도, skip, 시간 제한 늘리기로 해결하지 않고 제품 코드에서 원인을 고친다. 배치 병렬 실행(동시 4개)은 유지한다 (사람)"
---
## 요약
ci/archive.test.js의 CI 전용 간헐 실패를 고치는 bugfix intent 초안을 썼다. 우회 금지와 병렬 4개 유지를 제약으로 옮겼다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm run test:ci` (test/ + ci/), 로컬은 `npm test`. ci/ 에는 archive.test.js, batch.test.js가 있다.
- 참고(원인 근거 아님): docs/knowledge/runner/run-pool-result-order.md 는 runPool 결과 순서 문제를 다룸. 이번 증상(임시 파일 ENOENT, 고객사 뒤바뀜)과 관련 있는지는 fix에서 확인할 것.
- 현재 브랜치에 docs/knowledge/ 디렉터리는 없다.

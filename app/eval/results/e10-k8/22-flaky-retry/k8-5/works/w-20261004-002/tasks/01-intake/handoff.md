---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "초안 우선으로 사람에게 묻지 않고 초안을 썼다"
    why: "요청에 증상, 대상 시험, 범위 밖(batch.test.js)이 분명하고 업무 유형 bugfix가 요청과 맞다"
    by: ai
  - what: "간헐 실패를 덮지 않는 규칙을 제약으로 옮겼다"
    why: "팀 지식 docs/knowledge/testing/flaky-tests-fix-the-cause.md가 사람이 정한 규칙이다"
    by: ai
assumptions:
  - "ci/batch.test.js 쪽 수정은 별도 Work에서 리뷰 중이라 이번 변경과 겹치지 않는다고 본다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 3건(w-20261004-001에서 남김)은 기준 브랜치에 아직 없다. 같은 규칙을 어기는 코드가 이번 요청 밖에서 보여도 앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
ci/archive.test.js의 간헐 실패(임시 파일 ENOENT, 다른 고객사 내용)를 원인 코드에서 고치는 의도 초안을 썼다. 코드는 건드리지 않았다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test`(test/ 만), `npm run test:ci`(test/ + ci/). 재현은 `node --test ci/archive.test.js` 반복 실행.
- 참고할 팀 지식(조사로 알아낸 사실이며 이번 원인이라는 근거는 아님): `docs/knowledge/store/report-temp-file-name.md`, `docs/knowledge/runner/run-pool-result-order.md`. 기준 브랜치에는 아직 없고 코드 위치가 지금과 다를 수 있으니 지금 코드를 먼저 볼 것.
- 규칙: `docs/knowledge/testing/flaky-tests-fix-the-cause.md` (재시도, skip, 시간 제한, 순차 실행으로 덮지 않음).

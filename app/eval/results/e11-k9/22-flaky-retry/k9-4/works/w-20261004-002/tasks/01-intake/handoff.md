---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "완료조건에 test:ci 전체 반복 실행 결과를 근거로 남기는 항목을 넣는다"
    why: "팀 지식의 flaky-test-policy 규칙(사람이 정한 규칙)"
    by: ai
assumptions:
  - "ci/archive.test.js 외 다른 CI 시험의 간헐 실패는 이번 범위에 넣지 않았다. 단 test:ci 전체 반복은 완료조건에 있다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 docs/knowledge/store/report-temp-file-name.md는 앞 Work(w-20261004-001)에서 왔고 기준 브랜치에는 없다. 이 브랜치의 saveReport는 아직 시각 꼬리표만 쓰는 모양일 수 있으며, 앞 Work에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
ci/archive.test.js의 간헐 실패(ENOENT 임시 파일, 보관본 고객사 불일치)를 코드 원인으로 고치는 bugfix 의도를 초안으로 썼다. 재시도, skip, 병렬 축소는 해결이 아니라는 팀 규칙을 제약에 옮겼다.
## 다음 task가 알아야 할 것
- 시험: `ci/archive.test.js`, 실행은 `npm run test:ci`(test/ + ci/), 로컬은 `npm test`
- 보관 코드: `src/store/report-archive.js:21-25` saveReport. 임시 이름이 `.${stamp(now())}.tmp` 한 줄로 보인다(원인 확정 아님, 확인은 fix에서)
- 참고 지식(조사 사실, 근거 아님): `docs/knowledge/store/report-temp-file-name.md`, `docs/knowledge/runner/run-pool-result-order.md` (둘 다 기준 브랜치에 아직 없음)

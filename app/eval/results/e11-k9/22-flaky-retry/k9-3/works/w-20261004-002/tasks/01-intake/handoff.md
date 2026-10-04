---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "ci/batch.test.js는 비목표로 둔다"
    why: "요청에서 따로 고쳐 리뷰 중이라 이번 범위가 아니라고 함"
    by: human
assumptions:
  - "테스트 명령은 package.json의 test:ci와 test를 쓴다"
  - "팀 지식의 flaky 규칙(재시도·skip·시간 제한 증가·순차 실행 금지, 반복 실행 확인)이 이번 건에도 적용된다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 같은 종류의 문제(runPool 순서, saveReport 임시 파일 이름)를 고쳤을 수 있음, 머지 대기. 이 브랜치에는 그 수정이 없을 수 있음"
recommended_next: null
knowledge_candidates:
  - "간헐적으로 실패하는 시험은 재시도·skip·시간 제한 증가가 아니라 근본 원인을 고친다. 이번 archive 시험에도 같다 (사람)"
---
## 요약
ci/archive.test.js의 간헐 실패(ENOENT 임시 파일, 고객사 불일치)를 근본 원인부터 고치는 bugfix intent 초안을 썼다. ci/batch.test.js는 범위 밖이다.
## 다음 task가 알아야 할 것
- 테스트: `npm test`(test/), `npm run test:ci`(test/ + ci/). 대상은 `ci/archive.test.js`.
- 참고(원인 근거 아님, 기준 브랜치에는 아직 없음): `docs/knowledge/store/temp-file-unique-name.md`(saveReport 임시 파일 이름 `.<reportId>.<stamp>.tmp`), `docs/knowledge/runner/pool-result-order.md`(runPool 입력 순서 결과). 증상과 닮았으나 확인된 원인은 아니다. fix에서 직접 확인할 것.
- 현재 브랜치에는 `docs/knowledge/`가 없다.

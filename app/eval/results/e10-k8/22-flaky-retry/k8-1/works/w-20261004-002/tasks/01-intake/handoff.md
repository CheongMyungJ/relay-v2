---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "테스트 명령은 package.json 기준 npm test와 npm run test:ci로 잡았다"
  - "요청의 실패 로그는 한 원인에서 나온 것인지 아직 모른다. 원인 분석은 fix에서 한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 한 번 통과해도 해결 증거가 약하다. 반복 실행과 결정적 단위 시험이 필요하다"
  - "앞 Work(w-20261004-001)에서 비슷한 규칙을 어기는 코드를 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "간헐 실패 시험을 재시도, skip, 시간 제한 증가, 기대값 완화로 덮지 않고 원인을 코드에서 고친다 (사람)"
---
## 요약
ci/archive.test.js의 간헐 실패를 원인 수정으로 고치는 bugfix intent 초안을 썼다. ci/batch.test.js는 범위 밖이다.
## 다음 task가 알아야 할 것
- 테스트: `npm test`(test/), `npm run test:ci`(test/ + ci/). 로컬 npm test는 ci/를 돌리지 않는다.
- 관련 후보 파일(확인 안 함): `src/store/report-archive.js`, `src/store/file-store.js`, `src/handlers/report.js`, `src/nightly.js`, `test/archive.test.js`
- 참고 팀 지식(기준 브랜치에는 아직 없음): `docs/knowledge/runner/runpool-result-order.md`는 batch 쪽 원인 조사 기록이다. 이번 원인의 근거는 아니다.
- 규칙: `docs/knowledge/testing/flaky-tests-fix-cause.md`는 intent의 제약에 옮겼다.

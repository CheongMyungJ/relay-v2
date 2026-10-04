---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반복 실행 횟수를 20회로 잡는다"
    why: "간헐 실패라 한 번 통과로는 확인할 수 없음. 팀 규칙은 test:ci 반복 실행을 요구함"
    by: ai
assumptions:
  - "업무 유형 bugfix가 요청과 맞다고 봄"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: runPool 결과 순서(src/runner/pool.js), saveReport 임시 파일 이름(src/store/report-archive.js)"
recommended_next: null
knowledge_candidates:
  - "간헐 실패는 재시도, skip, 시간 제한 증가, 지연 설정 축소로 해결하지 않고 원인을 코드에서 제거한다 (사람, 이미 docs/knowledge/testing/flaky-tests-need-root-cause.md에 있음)"
---
## 요약
ci/archive.test.js의 test:ci 간헐 실패를 원인 제거로 고치는 bugfix intent 초안을 썼다. batch.test.js는 비목표.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test`, `npm run test:ci` (ci/ 시험은 지연이 있어 반복 실행 필요)
- 참고 팀 지식(기준 브랜치에는 아직 없음): docs/knowledge/store/report-temp-file-name.md, docs/knowledge/runner/runpool-result-order.md. 이번 증상(.tmp ENOENT, 고객사 뒤바뀜)과 비슷하지만 이번 원인이라는 확인은 안 됐으니 현재 코드를 직접 볼 것.

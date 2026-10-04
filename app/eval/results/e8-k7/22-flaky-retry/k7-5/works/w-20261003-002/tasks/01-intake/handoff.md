---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "ci/batch.test.js 간헐 실패와 병렬도 변경은 비목표로 둔다"
    why: "요청이 batch 쪽은 따로 리뷰 중이라고 밝혔고, 팀 규칙이 병렬 유지를 요구함"
    by: human
assumptions:
  - "완료조건의 반복 실행 횟수 20회는 팀 지식(ci 시험은 20회 이상 반복)에서 가져옴"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 고쳤을 수 있음, 머지 대기: runPool 결과 순서와 saveReport 임시 파일 이름 충돌 관련 코드가 이 브랜치에는 아직 없을 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
ci/archive.test.js의 간헐 실패를 근본 원인부터 고치는 intent 초안을 썼다. 비목표는 batch.test.js와 병렬도 축소, 완료조건에는 test:ci 20회 반복 통과를 넣었다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test`, `npm run test:ci`(package.json). ci/archive.test.js, ci/batch.test.js가 ci 전용.
- 참고(원인 근거 아님, 앞 Work 조사): docs/knowledge/ci-tests-expose-ordering-races.md, docs/knowledge/runpool-preserve-input-order.md. 이 파일들은 기준 브랜치에 아직 없다.
- 가설(확인 안 됨): 로그의 .tmp ENOENT는 saveReport 임시 파일 이름 충돌, 고객사 불일치는 순서 의존 가능성. fix에서 코드로 확인할 것.

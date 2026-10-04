---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "범위는 ci/archive.test.js의 간헐 실패로 한정하고 ci/batch.test.js는 제외한다"
    why: "요청에서 batch 쪽은 따로 고쳐 리뷰 중이라 이번 범위가 아니라고 함"
    by: human
  - what: "완료조건에 병렬 실행(동시 4개) 유지와 반복 실행 결과 보고를 추가한다"
    why: "사람이 의도 수정 요청에서 직접 요구함"
    by: human
assumptions:
  - "두 실패 로그(ENOENT, 고객사 불일치)가 같은 원인에서 나왔는지는 확인하지 않았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: 동시 실행 순서와 임시 파일 이름 관련 코드"
recommended_next: null
knowledge_candidates: []
---
## 요약
ci/archive.test.js 간헐 실패를 원인이 되는 src 코드에서 고치는 intent 초안을 썼다. 시험 재시도, skip, 시간 제한 늘리기는 쓰지 않는다.
## 다음 task가 알아야 할 것
- 참고 지식(원인 근거 아님): `docs/knowledge/runner/concurrency-order-pitfalls.md`. 보고서 임시 파일 이름과 같은 reportId 동시 저장 이야기가 있으며, 앞 Work 브랜치에서 왔고 기준 브랜치에는 아직 없다.
- 관련 후보 위치(추정, 확인 안 됨): `src/store/report-archive.js`
- 시험 명령: `npm test`, `npm run test:ci`, `node --test ci/archive.test.js` (반복 실행으로 간헐 실패 확인)

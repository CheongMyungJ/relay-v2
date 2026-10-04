---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "범위는 ci/archive.test.js 간헐 실패로 한정, batch.test.js는 제외"
    why: "요청에서 batch.test.js는 따로 리뷰 중이라 범위 밖이라고 함"
    by: human
assumptions:
  - "팀 지식의 규칙(병렬 유지, 재시도/skip/시간 늘리기 금지, 반복 실행 근거)이 이번 건에도 적용된다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 보관소 임시 파일 이름 충돌을 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates: []
---
## 요약
ci/archive.test.js 간헐 실패를 고치는 bugfix intent 초안을 썼다. 질문 없이 요청과 팀 지식으로 작성했다.
## 다음 task가 알아야 할 것
- 참고 팀 지식(기준 브랜치에는 아직 없음): `docs/knowledge/batch/ordering-and-tmp-file-pitfalls.md` (임시 파일 이름 동시성 함정).
- 내 가설(참고용, 확인 안 됨): `src/store/report-archive.js`의 `saveReport`가 임시 파일 이름을 `stamp(now())`만으로 만들어 같은 시각 동시 저장끼리 겹칠 수 있다. 증상(ENOENT 임시 파일, 다른 고객사 보관본)과 맞아 보인다.
- 검증: `npm run test:ci` 반복 실행. 로컬 `npm test`는 지연이 없어 항상 통과한다.

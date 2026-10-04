---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "임시 파일 이름에 reportId를 넣어 고유하게 한다"
    why: "같은 밀리초 저장끼리 이름이 겹치는 것이 원인. 시험은 건드리지 않고 제품 코드를 고친다 (docs/knowledge/testing/flaky-test-policy.md)"
    by: ai
assumptions: []
rejected:
  - "시험에 재시도·시간 제한 증가: 정책상 금지, 원인은 제품 코드의 이름 충돌"
open_questions: []
intent_deviation: null
risks:
  - "npm run test:ci 전체는 ci/batch.test.js 간헐 실패로 가끔 실패한다 (기준 커밋에서도 20회 중 6회). 비목표라 고치지 않았고 별도 Work에서 리뷰 중이다. 완료조건 `npm run test:ci 통과`는 그것이 머지돼야 안정적으로 충족된다."
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기"
recommended_next: null
knowledge_candidates:
  - "임시 파일·고유 이름을 시각(ms)만으로 만들면 지연이 있는 환경에서 동시 저장이 겹친다. 이름에 대상 id를 넣는다. src/store/report-archive.js saveReport"
---
## 요약
saveReport의 임시 파일 이름이 시각만 써서 동시 저장끼리 겹치던 것을 reportId를 넣어 고쳤다. 재현 시험을 추가했고 archive 시험은 40회 연속 통과했다.
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js:23`, 시험: `test/archive.test.js` 마지막 시험
- `ci/batch.test.js`는 기준 커밋에서도 간헐 실패(20회 중 6회), 이번 범위 밖
- 확인 명령: `for i in $(seq 1 40); do node --test ci/archive.test.js; done`

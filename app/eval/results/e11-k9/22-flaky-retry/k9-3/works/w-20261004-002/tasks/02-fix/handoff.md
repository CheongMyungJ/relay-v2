---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "임시 파일 이름에 reportId를 넣는 것으로 고친다"
    why: "docs/knowledge/store/temp-file-unique-name.md 규칙과 같고 재시도·skip·순차화 없이 근본 원인을 고침"
    by: ai
  - what: "ci/batch.test.js의 간헐 실패(runPool 순서)는 고치지 않는다"
    why: "intent의 비목표"
    by: ai
assumptions:
  - "ci/batch.test.js의 실패는 runPool 입력 순서 문제로 보이며 기준 커밋에서 따로 확인하지 않았다"
rejected:
  - "runPool 결과 순서: archive 시험은 reportId로 보관본을 읽어 인덱스 짝짓기에 의존하지 않음"
open_questions: []
intent_deviation: null
risks:
  - "npm run test:ci는 ci/batch.test.js(비목표) 간헐 실패 때문에 가끔 실패한다 (30회 중 9회). 완료조건 'npm run test:ci가 통과한다'는 그 수정이 머지되어야 안정적으로 충족된다"
  - "앞 Work(w-20261004-001)에서 같은 saveReport 임시 파일 문제를 고쳤을 수 있음, 머지 대기. 머지 때 충돌 가능"
  - "같은 reportId를 동시에 두 번 저장하는 경우는 보호하지 않는다"
recommended_next: null
knowledge_candidates:
  - "saveReport 임시 파일 이름을 시각만으로 만들면 동시 저장이 같은 ms에 겹쳐 ENOENT와 고객사 뒤바뀜이 난다. reportId를 넣어 고쳤다 (src/store/report-archive.js:23)"
  - "간헐 실패 시험은 시각을 고정해 충돌을 결정적으로 만드는 재현 시험을 추가하고 반복 실행으로 확인한다"
---
## 요약
`saveReport`의 임시 파일 이름이 시각만으로 정해져 같은 ms의 동시 저장이 충돌하던 것을 `.<reportId>.<stamp>.tmp`로 고쳤다. 시각 고정 재현 시험을 추가했고 수정 전 실패, 수정 뒤 통과를 확인했다.
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js:23`. 시험: `test/archive.test.js` 마지막 시험.
- `npm test` 통과(63). `ci/archive.test.js`는 60회 연속 통과.
- `npm run test:ci`는 30회 중 9회 `ci/batch.test.js`(비목표, runPool 순서 추정) 때문에 실패했다. 이번 수정과 무관.

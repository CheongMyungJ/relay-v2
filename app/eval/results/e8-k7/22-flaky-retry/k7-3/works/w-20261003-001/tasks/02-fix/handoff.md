---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "ci/archive.test.js의 간헐 실패(임시 파일 이름 충돌)도 같은 수정에서 고친다"
    why: "완료조건 `npm run test:ci` 통과에 필요하고 src/ 안의 같은 종류(지연 의존) 버그라 범위를 넓히지 않는다"
    by: ai
assumptions:
  - "reportId가 주어진 report는 reportId가 다르면 임시 파일 이름이 겹치지 않는다고 봤다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "같은 reportId를 같은 ms에 동시에 두 번 저장하면 임시 파일이 겹칠 수 있다(현재 호출 경로에는 없음)"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 입력 순서와 같아야 한다. collectResults가 index로 job과 짝짓는다 (src/runner/pool.js, src/collect/collector.js)"
  - "saveReport 임시 파일 이름은 reportId를 포함해야 동시 저장에서 겹치지 않는다 (src/store/report-archive.js)"
---
## 요약
간헐 실패의 원인 둘을 src에서 고쳤다. runPool이 완료 순서로 결과를 모아 job과 어긋났고, saveReport 임시 파일 이름이 ms 단위라 동시 저장이 겹쳤다. 재시도, skip, 시간 제한, 동시성은 건드리지 않았다.
## 다음 task가 알아야 할 것
- 수정: `src/runner/pool.js`, `src/store/report-archive.js`. 시험: `test/pool.test.js`, `test/archive.test.js` 각 1개 추가(수정 전 실패 확인).
- 반복 결과: 수정 전 batch.test.js 20회 중 7회 실패. 수정 후 batch.test.js 20/20, archive.test.js 20/20 통과, `npm run test:ci` 10/10 통과, `npm test` 64 pass.
- 변경은 커밋됨.

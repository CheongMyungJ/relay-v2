---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "임시 파일 이름에 reportId를 넣어 저장마다 고유하게 한다"
    why: "시각(ms)만 쓰면 같은 ms에 시작한 동시 저장이 같은 임시 파일을 공유함. 시험 쪽이 아니라 원인 코드를 고침"
    by: ai
assumptions:
  - "같은 reportId·같은 ms에 동시에 두 번 저장하는 경우는 없다고 봄"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "같은 reportId를 같은 ms에 동시에 저장하면 여전히 임시 이름이 겹침"
  - "기준 커밋에서의 실패는 간헐이라 한 번의 실행으로는 비교하지 못함 (이번 수정 전 재현은 20회 중 약 8회 실패로 확인)"
recommended_next: null
knowledge_candidates:
  - "임시 파일 이름을 시각만으로 만들면 동시 작업이 같은 이름을 쓴다. 임시 이름에는 작업 고유 값(reportId)을 넣는다. src/store/report-archive.js saveReport"
---
## 요약
보고서 저장의 임시 파일 이름이 시각(ms)만으로 만들어져 동시 저장끼리 겹치던 것을 고쳤다. 겹치면 ENOENT와 다른 고객사 보관본이 생겼다. 재현 테스트를 추가했고 CI 시험 30회 연속 통과, `npm run test:ci` 통과.
## 다음 task가 알아야 할 것
- 수정: `src/store/report-archive.js` saveReport의 `tmp` 이름
- 재현 테스트: `test/archive.test.js` 마지막 시험 (시계 고정 + 동시 저장)
- 재현 명령: `for i in $(seq 20); do node --test ci/archive.test.js; done` (수정 전 약 40% 실패)
- 기존 테스트 변경 없음, `ci/batch.test.js` 건드리지 않음

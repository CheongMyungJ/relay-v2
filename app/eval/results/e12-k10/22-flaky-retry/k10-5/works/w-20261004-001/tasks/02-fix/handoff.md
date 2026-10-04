---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "원인 두 개를 모두 이번 수정에서 고친다"
    why: "둘 다 같은 증상(CI 간헐 실패)의 원인이고 완료조건이 반복 실행 안정성을 요구함. 하나만 고치면 15회 중 7회 실패가 남음"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "임시 파일 이름이 `.reportId.stamp.tmp`로 바뀌었다. 같은 reportId를 같은 ms에 동시에 저장하는 경우는 여전히 겹친다"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 입력 순서여야 한다. collectResults가 인덱스로 job과 짝짓는다 (src/runner/pool.js)"
  - "보고서 임시 파일 이름은 동시 저장끼리 겹치지 않아야 한다. 시각만으로는 부족하다 (src/store/report-archive.js)"
---
## 요약
간헐 실패의 원인은 둘이었다. runPool이 결과를 완료 순서로 모았고, saveReport의 임시 파일 이름이 같은 ms에 겹쳤다. 둘 다 고치고 재현 시험을 추가했다.
## 다음 task가 알아야 할 것
- `src/runner/pool.js`: 결과를 `results[start + i]`에 저장
- `src/store/report-archive.js:23`: 임시 이름에 reportId 포함
- 검증: `npm run test:ci`를 반복 실행(30회 통과 확인)
- 새 시험: `test/pool.test.js`, `test/archive.test.js` 마지막 시험

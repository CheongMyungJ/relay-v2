---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "완료조건에 반복 실행 안정성 항목을 추가"
    why: "간헐 실패라 한 번 통과로는 해결을 확인할 수 없음"
    by: ai
assumptions:
  - "업무 유형 bugfix는 요청 내용과 맞음"
  - "원인은 report와 job을 짝짓는 과정의 경쟁 상태로 보이나 확인하지 않음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 재현 빈도가 낮으면 수정 확인이 어려움"
recommended_next: null
knowledge_candidates:
  - "재시도, skip, 시간 제한 늘리기는 flaky 시험의 해결이 아니다. 근본 원인을 고친다 (사람)"
---
## 요약
ci/batch.test.js의 간헐 실패(report-6이 job-5로 귀속)를 근본 원인부터 고치는 의도 초안을 썼다. 시험 우회는 비목표로 뒀다.
## 다음 task가 알아야 할 것
- 시험 명령: `npm run test:ci`(test/ + ci/), 로컬은 `npm test`(test/만)
- 관련 후보 코드(가설, 확인 안 됨): `src/runner/`, `src/handlers/report.js`, `src/collect/`, `src/store/report-archive.js`, `src/util/jitter.js`, `src/nightly.js`
- 팀 지식 항목 없음

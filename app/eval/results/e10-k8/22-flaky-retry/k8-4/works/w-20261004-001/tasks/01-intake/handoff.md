---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "재현 확인은 하지 않았다. 간헐 실패라 반복 실행으로 확인해야 한다고 가정했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "간헐 실패라 한 번 통과한 것만으로 해결을 판단할 수 없다. 반복 실행이 필요하다"
recommended_next: null
knowledge_candidates:
  - "배치의 병렬 실행(동시 4개)은 유지해야 하며 순차 실행으로 되돌리면 안 된다 (사람)"
  - "간헐 실패를 고쳤다는 근거는 test:ci를 여러 번 반복 실행한 결과로 보여 준다 (사람)"
  - "시험에 재시도 추가, skip, 시간 제한 늘리기는 간헐 실패의 해결이 아니다. 근본 원인을 고친다 (사람)"
---
## 요약
ci/batch.test.js의 간헐 실패(report-6이 job-5에 속함)를 근본 원인부터 고치는 intent 초안을 썼다.
## 다음 task가 알아야 할 것
- 시험 명령: `npm run test:ci` (`test/**`와 `ci/**` 실행), 로컬은 `npm test`
- 관련 파일: `ci/batch.test.js`, `src/`
- 팀 지식 항목 없음

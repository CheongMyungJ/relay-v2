---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "ci/archive.test.js의 간헐 실패(임시 파일 이름 충돌)도 src에서 함께 고침"
    why: "완료조건 `npm run test:ci` 통과에 필요하고, 같은 동시 실행+지연 계열이며 src 수정이라 비목표에 해당하지 않음"
    by: ai
assumptions: []
rejected:
  - "report 핸들러/jitter 문제: 상태 공유가 없고 지연은 완료 순서만 바꿈"
open_questions: []
intent_deviation: null
risks:
  - "runPool의 done 값은 같은 의미(끝난 수)로 유지했으나 결과 배열은 이제 항상 입력 순서"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 작업 완료 순서가 아니라 입력 순서여야 collectResults가 맞게 짝짓는다. 지연이 있는 ci/ 시험에서만 드러난다"
  - "보고서 임시 파일 이름은 reportId를 넣어 동시 저장 때 겹치지 않게 한다 (src/store/report-archive.js)"
---
## 요약
원인은 runPool이 결과를 완료 순서로 쌓은 것이다. 입력 순서로 담게 고쳤다. 같은 조건에서 드러나던 보고서 임시 파일 이름 충돌도 고쳤다. 재현 테스트 2건을 추가했다.
## 다음 task가 알아야 할 것
- `src/runner/pool.js`: results[start + i]에 저장
- `src/store/report-archive.js` saveReport: tmp 이름에 reportId
- 검증: `npm test`, `npm run test:ci` 30회 반복 모두 통과

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "runPool 결과를 입력 인덱스에 넣어 순서를 보존한다"
    why: "collectResults가 인덱스로 짝짓기 때문. 병렬은 유지"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "runPool의 결과 순서가 바뀌므로 완료 순서에 의존하던 호출자가 있으면 영향(레포 안에는 없음)"
recommended_next: null
knowledge_candidates:
  - "runPool 결과는 입력 순서여야 한다. collectResults가 인덱스로 job과 짝짓기 때문이며, 지연이 있는 CI 시험에서만 어긋남이 드러난다 (src/runner/pool.js)"
---
## 요약
원인은 runPool이 결과를 완료 순서로 push한 것. 인덱스 위치에 넣도록 고치고 재현 테스트를 추가했다.
## 다음 task가 알아야 할 것
- 수정: `src/runner/pool.js`, 테스트: `test/pool.test.js` 마지막 케이스
- `npm test` 63, `npm run test:ci` 67 통과, batch.test.js 20회 연속 통과(수정 전 10회 중 5회 실패)

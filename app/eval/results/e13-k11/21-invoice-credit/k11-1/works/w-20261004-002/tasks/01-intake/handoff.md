---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세 기준을 팀 지식의 줄별 버림 규칙으로 삼는다"
    why: "팀 지식 vat-per-line-floor.md가 규칙으로 덮는다. 사람에게 다시 묻지 않는다"
    by: ai
assumptions:
  - "회계팀 계산은 줄별 부가세 버림 합산 방식이라고 가정한다. 요청에 기대 금액은 없다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 lineVat을 도입했을 수 있고 머지 대기 중이다. 이 브랜치에는 lineVat이 없을 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
CN-0112 환불 합계 불일치를 고치는 bugfix 의도 초안을 썼다. 팀 지식 두 건을 제약에 옮겼다.
## 다음 task가 알아야 할 것
- 관련 코드: `src/invoice/credit-note.js`의 `creditTotals`. 부가세를 과세분 합계에 대해 한 번에 `Math.round`로 계산하는 것으로 보인다(가설, 확인 안 됨).
- `src/invoice/total.js`에 `lineVat`이 있는지 확인한다. 팀 지식은 앞 Work에서 온 것이다.
- 입력: `examples/CN-0112.json`, `examples/INV-2047.json`. 테스트: `npm test`(`node --test`), `test/credit-note.test.js`.
- 참고 지식: `docs/knowledge/invoice/vat-per-line-floor.md`, `docs/knowledge/invoice/issued-invoice-stored-totals.md`

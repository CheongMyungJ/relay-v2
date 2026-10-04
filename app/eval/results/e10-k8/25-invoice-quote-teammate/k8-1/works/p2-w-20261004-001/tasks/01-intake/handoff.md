---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "기대 합계는 회계팀 부가세 규칙(줄별 버림 합산)으로 계산한 값으로 본다"
    why: "요청에 경리의 기대 금액이 없고 팀 지식에 규칙이 있음"
    by: ai
assumptions:
  - "경리 계산도 줄별 버림 규칙을 따른다고 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "경리가 계산한 정확한 금액을 모르므로 기대값이 규칙 계산과 다를 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
견적서 Q-0457 합계 불일치를 바로잡는 버그 수정 의도 초안을 썼다. 견적 번호 형식, 유효 기간 계산, `src/format/` 출력은 비목표로 못 박았다.
## 다음 task가 알아야 할 것
- 참고 가설(원인 확인 안 됨): 현재 코드로 `createQuote`에 `examples/Q-0457.json`을 넣으면 supply 52,691 / vat 3,587 / total 56,278이 나온다. 요청의 56,280과 2원 차이다. `src/invoice/quote.js`의 `quoteTotals`는 이미 줄별 버림이라, 안내된 56,280이 옛 규칙으로 저장된 값인지 다른 경로(`examples`, 저장 합계, 출력)에서 오는지 fix에서 확인해야 한다.
- 참고 지식: `docs/knowledge/invoice/vat-per-line-floor.md`, `docs/knowledge/invoice/issued-totals-are-stored.md`, `docs/knowledge/format/output-frozen.md`
- 테스트: `npm test` (node --test), 견적 테스트는 `test/quote.test.js`

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "기대 합계를 56,278원(부가세 3,587원)으로 intent에 적는다"
    why: "팀 지식의 회사 부가세 규칙과 Q-0457 예시"
    by: ai
  - what: "fix에서 56,280원이 나오는 경로를 가장 먼저 재현한다"
    why: "사람이 확인함: 경리 계산 56,278원이 맞고, 56,280원은 견적서에 찍힌 금액이며 출처는 모른다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "intake 중 현재 src/invoice/quote.js로 Q-0457을 계산하면 이미 56,278원이 나온다. 요청의 56,280원이 어디서 나오는지(저장된 합계, 다른 경로 등)는 확인하지 않았다"
  - "npm test에서 5건이 실패하는 상태다 (원인 미확인)"
recommended_next: null
knowledge_candidates: []
---
## 요약
Q-0457 견적 합계 불일치를 고치는 bugfix intent 초안을 썼다. 기대값은 회사 규칙에 따라 56,278원이다. 질문은 없었다.
## 다음 task가 알아야 할 것
- 사람 지시: 56,280원의 출처(코드 외 경로 가능성 포함)를 재현하는 것이 fix의 첫 일이다. 경리 합계 56,278원은 사람이 맞다고 확인했다
- 참고 지식: `docs/knowledge/invoice-vat-per-line-floor.md`, `docs/knowledge/issued-invoice-and-format-untouched.md`
- 코드: `src/invoice/quote.js`의 `quoteTotals`, `src/invoice/total.js`의 `lineVat`. 데이터는 `examples/Q-0457.json`
- 확인한 것(원인 아님): `createQuote`로 Q-0457을 계산하면 vat 3587, total 56278이 나온다. 56,280원이 나오는 경로를 fix에서 찾아야 한다
- `npm test`: 55건 중 5건 실패 상태로 시작한다

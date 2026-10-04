---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "Q-0457의 올바른 합계는 56,278원이다"
    why: "사람이 경리 계산이 56,278원이라고 답했고, 팀 규정으로 직접 계산해도 같다"
    by: human
assumptions:
  - "요청의 56,280원이 어디서 나오는지는 확인하지 않았다 (intake는 원인 분석을 하지 않음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "quoteTotals는 지금 56,278원을 돌려준다. 56,280원이 나오는 경로가 다른 곳에 있을 수 있다"
recommended_next: null
knowledge_candidates: []
---
## 요약
Q-0457 견적 합계가 경리보다 2원 많다는 버그의 intent를 썼다. 기대 합계는 56,278원이다.
## 다음 task가 알아야 할 것
- 참고 지식: `docs/knowledge/accounting/vat-rounding.md`, `docs/knowledge/invoice/issued-invoice-and-format.md`
- `node -e`로 `createQuote(examples/Q-0457.json).totals`를 계산하면 supply 52,691, vat 3,587, total 56,278이다. `src/invoice/quote.js`의 `quoteTotals`는 이미 줄별 `floorPercentOf`를 쓴다. `npm test` 53건 통과.
- 요청의 56,280원이 나오는 위치는 아직 모른다. 견적 합계를 표시하거나 저장하거나 내보내는 다른 경로(`src/`)를 확인해야 한다.
- (참고 가설, 확인 안 됨) 2원 차이는 할인 줄(퍼센트 할인 반올림)이나 다른 경로의 계산에서 생겼을 수 있다.

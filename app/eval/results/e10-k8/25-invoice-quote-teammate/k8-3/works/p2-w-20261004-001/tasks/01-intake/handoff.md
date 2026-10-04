---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적서 합계의 기준은 팀 지식의 줄별 버림 규칙으로 한다"
    why: "경리 금액이 요청에 없고, 팀 지식 vat-per-line-floor.md가 견적서에도 같은 규칙을 정함"
    by: ai
assumptions:
  - "경리 계산 금액은 줄별 원 단위 버림 규칙으로 계산한 값이라고 본다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "경리가 계산한 정확한 금액을 모른다. 규칙으로 계산한 값과 다르면 다른 원인일 수 있다"
recommended_next: null
knowledge_candidates:
  - "견적 번호 형식(Q-0000)과 유효 기간 계산은 영업 시스템이 그대로 읽으므로 바꾸지 않는다 (사람)"
---
## 요약
견적서 Q-0457 합계 불일치를 고치는 bugfix 의도 초안을 썼다. 견적 번호 형식과 유효 기간 계산은 비목표로 두었고, 줄별 버림 규칙은 제약으로 옮겼다.
## 다음 task가 알아야 할 것
- 참고 지식: `docs/knowledge/billing/vat-per-line-floor.md` (줄별 버림 규칙, `lineVat`)
- 데이터 `examples/Q-0457.json`: 5줄, % 할인 줄과 금액 할인 줄, 면세 줄(`BK-1680`) 포함
- 코드 `src/invoice/quote.js` `quoteTotals`, 할인은 `src/invoice/discount.js`. 원인은 확인하지 않았다
- 테스트 명령: `npm test` (`node --test`), 견적 테스트는 `test/quote.test.js`

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적서 Q-0457의 기대 합계를 56,278원으로 한다"
    why: "팀 지식의 부가세 규칙(줄마다 할인 후 금액 버림)과 예시 값"
    by: ai
assumptions:
  - "요청의 '경리 담당 계산'은 팀 지식의 줄별 버림 규칙과 같은 값이라고 본다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "quote.js를 고치면서 견적 번호 형식이나 유효 기간 계산을 건드릴 수 있으니 fix에서 확인해야 한다"
recommended_next: null
knowledge_candidates:
  - "견적 번호 형식과 유효 기간 계산은 영업 시스템이 그대로 읽으므로 바꾸면 안 된다 (사람)"
---
## 요약
견적서 Q-0457 합계가 56,280원으로 나와 경리 계산과 어긋나는 버그의 의도를 정리했다. 기대 합계는 56,278원이고, 번호 형식과 유효 기간 계산은 바꾸지 않는다.
## 다음 task가 알아야 할 것
- 테스트 명령은 `npm test`(`node --test`)이고, 관련 테스트는 `test/quote.test.js`, `test/vat-per-line.test.js`다.
- 대상은 `src/invoice/quote.js`와 `examples/Q-0457.json`이다. 코드는 읽지 않았다.
- 참고할 팀 지식은 `docs/knowledge/vat-per-line-floor.md`, `docs/knowledge/vat-separate-calc-in-quote-credit-note.md`다. 견적서는 computeTotals를 쓰지 않고 따로 계산한다.
- `docs/knowledge/issued-invoice-no-recalc.md`: 공용 계산을 건드리면 발행된 청구서가 다시 계산되지 않게 한다.

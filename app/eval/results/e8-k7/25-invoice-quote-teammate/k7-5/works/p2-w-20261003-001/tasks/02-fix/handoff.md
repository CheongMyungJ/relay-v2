---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적 코드는 바꾸지 않고, npm test를 막던 credit-note.js의 깨진 참조만 lineVat으로 고친다"
    why: "견적은 8c0b9cc에서 이미 고쳐져 있고, 완료조건 npm test 통과를 위해 필요하다. 규칙은 docs/knowledge/invoice-vat-per-line-floor.md"
    by: ai
assumptions:
  - "56,280원 견적서는 초기 커밋의 옛 계산식(할인 전 금액 반올림 후 할인분 부가세 차감)이 만든 것으로 추정한다. 실제 발송본은 확인하지 못했다"
rejected:
  - "현재 코드에 다른 견적 합계 경로가 있다는 가설: quoteTotals 외에 합계를 내는 코드가 없다"
open_questions: []
intent_deviation: null
risks:
  - "이미 56,280원으로 나간 견적서는 코드로 바뀌지 않는다. 필요하면 재발행이 필요하다"
  - "새 테스트를 추가하지 않았다. 기존 Q-0457, CN-0112 테스트가 이 결함을 잡는다"
recommended_next: null
knowledge_candidates:
  - "Q-0457의 56,280원은 옛 견적 계산식(할인 전 금액 부가세에서 할인분 부가세를 뺌, vat 3,589)이 만든 값이다. 8c0b9cc에서 줄별 버림 합으로 고쳐져 3,587/56,278이 된다"
---
## 요약
현재 코드는 이미 Q-0457을 56,278원으로 계산한다. 56,280원은 초기 커밋의 옛 식에서 재현된다. npm test를 막던 반품 전표의 `VAT_RATE_PERCENT` 미정의 참조를 `lineVat`으로 고쳐 55/55 통과한다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js:94` `lineVat(r.net)` 사용
- 확인: `node src/cli.js examples/Q-0457.json` → vat 3587, total 56278. 초기 커밋 973a500은 3589/56280
- `npm test` 55/55 통과. 실패 5건은 기준 커밋에서도 실패하던 것
- 견적 번호 형식, `quoteValidUntil`, `src/format/`은 건드리지 않았다

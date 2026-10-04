---
status: "awaiting_approval"
blocked_reason:
decisions:
  - what: "청구서·반품 전표는 이번 범위에서 제외하고 견적서만 다룬다"
    why: "요청이 견적서 Q-0457 합계 문의이고 발행된 합계는 재계산하지 않는 규칙이 있다"
    by: ai
assumptions:
  - "경리 계산은 팀 지식의 부가세 규칙(줄별 할인 후 내림 합산)과 같다고 가정했다"
  - "정확한 기대 합계 값은 요청에 없어서 intent에 숫자로 적지 않았다. fix가 규칙으로 손계산해 확인한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "경리 계산 값을 요청에서 받지 못해, 몇 원 차이인지 확인되지 않았다"
recommended_next: null
knowledge_candidates: []
---
## 요약
견적서 Q-0457의 합계가 경리 계산과 다른 버그를 고치는 intent 초안을 썼다. 견적 번호 형식과 유효 기간 계산은 바꾸지 않는 것을 비목표와 완료조건에 넣었다.
## 다음 task가 알아야 할 것
- 참고(내 가설, 확인 안 됨): 현재 코드에서 `createQuote(examples/Q-0457.json)`를 호출하면 `TypeError: 금액은(는) 정수 원이어야 한다`로 실패한다. `src/invoice/quote.js:39`가 `sumLineVat`에 줄 객체 배열(rows)을 넘기는데 `src/invoice/vat.js:13`은 정수 금액 배열을 받는다. 보고된 56,280원과의 관계는 확인해야 한다.
- 할인(비율 15%) 반올림 방식은 `src/invoice/discount.js` 확인 필요.
- 테스트: `npm test` (node --test), 관련 `test/quote.test.js`.
- 참고 팀 지식: docs/knowledge/invoice/vat-per-line-floor.md, format-output-unchanged.md

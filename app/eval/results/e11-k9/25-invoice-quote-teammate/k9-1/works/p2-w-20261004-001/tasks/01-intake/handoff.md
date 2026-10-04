---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "기대 합계는 팀 지식의 부가세 규칙으로 정하고 사람에게 다시 묻지 않는다"
    why: "docs/knowledge/vat/line-floor-vat.md가 견적서에도 같은 규칙이라고 명시함"
    by: ai
assumptions:
  - "경리 계산은 줄마다 원 단위 버림 규정을 따른다고 가정함"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "quote.js가 이미 줄별 버림 방식으로 보이므로 차이의 원인이 다른 곳(줄 금액, 할인 계산 등)일 수 있음. fix에서 확인 필요"
recommended_next: null
knowledge_candidates:
  - "견적 번호 형식(Q-0000)과 유효 기간 계산은 영업 시스템이 그대로 읽으므로 바꾸면 안 된다 (사람)"
---
## 요약
견적서 Q-0457 합계(56,280원)가 경리 계산과 다르다는 버그 수정 의도를 정리했다. 기대값은 팀 지식의 줄별 원 단위 버림 규칙이다. 견적 번호 형식과 유효 기간 계산은 비목표다.
## 다음 task가 알아야 할 것
- 테스트 명령: `npm test` (`node --test`)
- 코드: `src/invoice/quote.js`의 `quoteTotals`, 입력은 `examples/Q-0457.json`
- 참고 지식: `docs/knowledge/vat/line-floor-vat.md`, `docs/knowledge/vat/issued-invoice-stored-totals.md`
- 가설(확인 안 됨): `quoteTotals`는 이미 `lineVat`로 줄별 버림을 하는 것으로 보임. 차이는 줄 금액(`lineGross`, `lineDiscount`, 할인 %와 정액) 쪽에서 날 수 있음.

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "견적서 부가세를 팀 지식의 줄별 버림 규칙으로 맞추는 것을 기대 동작으로 한다"
    why: "팀 지식 vat-per-line-floor.md가 규칙이고, 견적서는 아직 따르지 않는 곳으로 적혀 있으며 이번 요청이 그 코드를 고치는 일이다"
    by: ai
assumptions:
  - "Q-0457 문의의 원인이 부가세 계산 방식 차이라고 가정하지 않는다. 원인은 fix에서 확인한다"
  - "견적서의 할인 줄 부가세는 할인 후 공급가액(줄 net)에 줄별 버림을 적용하는 것이 규칙에 맞다고 본다. fix에서 현재 할인 처리(`lineDiscount`)와 함께 확인한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "견적서 합계가 바뀌면 같은 품목으로 만드는 청구서와 금액이 어긋날 수 있어 비교가 필요하다"
recommended_next: null
knowledge_candidates: []
---
## 요약
견적서 Q-0457 합계 문의 건을 버그 수정으로 정리했다. 팀 지식의 부가세 줄별 버림 규칙을 제약으로 옮겼고, 견적 번호 형식과 유효 기간 계산은 비목표로 못 박았다.
## 다음 task가 알아야 할 것
- `src/invoice/quote.js` `quoteTotals`: 현재 부가세가 과세 줄 gross 합의 `percentOf`에서 할인 합의 `percentOf`를 빼는 방식이다. 이것은 원인 확정이 아니라 읽은 모양이다.
- 참고 지식: `docs/knowledge/invoice/vat-per-line-floor.md`. 사람이 정한 줄별 버림 규칙이고 견적서는 아직 따르지 않는 곳으로 적혀 있다.
- 견적 데이터: `examples/Q-0457.json`, 테스트: `test/quote.test.js`, 실행: `npm test`.
- 바꾸면 안 되는 것: 견적 번호 형식 검사, `quoteValidUntil`, `isQuoteExpired`.

---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "경리 계산 금액은 요청에 없어, 회계팀 규칙(vat-per-line-floor)으로 손계산한 값을 기준으로 삼는다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "경리가 다른 기준으로 계산했다면 규칙과 어긋날 수 있다. fix에서 손계산 값과 56,280원을 비교해 확인한다"
recommended_next: null
knowledge_candidates: []
---
## 요약
견적서 Q-0457 합계 불일치를 회계팀 부가세 규칙에 맞게 고치는 의도를 정리했다. 견적 번호 형식과 유효 기간 계산은 비목표로 못 박았다.
## 다음 task가 알아야 할 것
- 계산: `src/invoice/quote.js`의 `quoteTotals`. 데이터: `examples/Q-0457.json` (할인 15%, 정액 777원, 면세 도서 줄 포함)
- 테스트: `npm test` (`node --test`), 관련 `test/quote.test.js`, `test/vat-per-line.test.js`
- 참고 지식: `docs/knowledge/billing/vat-per-line-floor.md`(규칙). `issued-invoice-totals-frozen.md`는 발행된 청구서 저장값 관련 사실이다.
- 코드는 이미 `sumLineVat`을 쓰는 것으로 보인다. 원인은 직접 확인이 필요하다(가설 아님, 참고).

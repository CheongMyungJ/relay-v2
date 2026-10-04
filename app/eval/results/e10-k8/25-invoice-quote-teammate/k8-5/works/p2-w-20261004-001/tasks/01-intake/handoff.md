---
status: "awaiting_approval"
blocked_reason:
decisions: []
assumptions:
  - "경리 계산 금액이 요청에 없어, 기준을 회계팀 규정(줄별 버림 부가세)으로 계산한 값으로 잡았다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "경리가 규정 외 방식으로 계산했을 가능성은 확인하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
견적서 Q-0457 합계 오차를 바로잡는 버그 수정 의도 초안을 썼다. 견적 번호 형식과 유효 기간 계산은 비목표로 못 박았다.
## 다음 task가 알아야 할 것
- 코드: `src/invoice/quote.js`의 `quoteTotals`, 데이터: `examples/Q-0457.json`, 테스트: `test/quote.test.js`, 명령: `npm test`
- 훑어본 인상(가설, 확인 안 됨): `quoteTotals`는 이미 `sumLineVat`을 쓰는 것처럼 보인다. 원인은 `lineGross`/`lineDiscount`/`isTaxableLine` 쪽일 수 있다.
- 참고 지식: `docs/knowledge/billing/vat-per-line-floor.md`(제약에 옮김), `docs/knowledge/billing/example-json-needs-normalize.md`(예제 JSON은 정규화해야 과세 구분이 채워짐)

---
status: "awaiting_approval"
blocked_reason:
decisions: []
assumptions:
  - "기대 금액 19,180원은 팀 지식(회계팀 규칙)의 CN-0112 예시를 따랐다. 코드로 재현해 확인하지는 않음"
  - "저장된 금액을 쓰는 기존 반품 전표는 재계산하지 않는다(요청 원문)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 청구서·견적의 부가세를 고쳤을 수 있음, 머지 대기. 이 브랜치에는 lineVat(src/invoice/total.js)이 아직 없다"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 환불 금액이 회계팀 계산과 어긋나는 버그의 의도 초안을 썼다. 회사 부가세 규칙(줄별 버림 합산)을 반품 전표에도 적용하고, 발행분 재계산 금지와 src/format/ 불변을 제약에 넣었다.
## 다음 task가 알아야 할 것
- 참고(원인 아님): `src/invoice/credit-note.js`의 `creditTotals`는 `Math.round((taxable * VAT_RATE_PERCENT) / 100)`로 과세 합계에 한 번 반올림한다. `src/invoice/total.js`의 `computeTotals`도 같은 모양이다. 줄별 계산과 다를 수 있다는 가설일 뿐, 확인하지 않았다.
- `returnedDiscount`의 금액 할인은 `Math.round`로 나눈다. 할인 반올림도 금액 차이의 후보일 수 있다(가설).
- 팀 지식 참고: `docs/knowledge/invoice-vat-per-line-floor.md`, `docs/knowledge/issued-invoice-and-format-untouched.md` (기준 브랜치에는 아직 없음)
- 테스트: `npm test` (`test/credit-note.test.js`, `test/total.test.js`)

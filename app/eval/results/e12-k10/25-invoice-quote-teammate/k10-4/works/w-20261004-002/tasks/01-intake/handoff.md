---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세는 줄별 원 단위 버림 규정을 따른다"
    why: "팀 지식 vat-rounding.md가 반품 전표(creditTotals)도 같은 규정이라고 명시"
    by: human
assumptions:
  - "CN-0112 기대값 19,180원은 부분 반품 할인의 기존 반올림(returnedDiscount)을 그대로 둔다는 가정으로 계산했다"
  - "기준 브랜치에 docs/knowledge/가 아직 없어 지식 항목은 context.md의 내용을 따랐다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 floorPercentOf 등을 고쳤을 수 있음, 머지 대기. 이 브랜치의 src/money.js에는 floorPercentOf가 없다"
  - "금액 할인을 수량 비율로 나눌 때의 반올림 규정은 지식에 없어 이번 의도에서 건드리지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표(CN-0112 등)의 환불 금액이 회계팀 계산과 몇 원 다른 버그의 의도를 정리했다. 부가세를 줄별 원 단위 버림으로 계산하는 팀 규정을 제약에 옮겼다.

## 다음 task가 알아야 할 것
- 참고 지식: docs/knowledge/accounting/vat-rounding.md, docs/knowledge/invoice/issued-invoice-and-format.md (기준 브랜치에는 아직 없음)
- 코드 위치: `src/invoice/credit-note.js` `creditTotals`, `returnedDiscount`. 테스트는 `test/credit-note.test.js`, 실행은 `npm test`
- 참고 가설(확인 안 됨): `creditTotals`가 과세 합계에 한 번 `Math.round`로 부가세를 매기는 것으로 보인다. 손으로 줄별 버림을 계산하면 CN-0112는 부가세 1,742원, 합계 19,180원이다(현재 1,744원, 19,182원).
- `src/money.js`에는 `percentOf`(반올림)만 있고 `floorPercentOf`는 없다. `src/invoice/quote.js:42`도 합계 기준 반올림처럼 보여 같은 규정과 어긋날 수 있으나, 이번 요청 범위는 반품 전표다.

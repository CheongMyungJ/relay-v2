---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세는 돌려받는 과세 줄마다 원 단위 버림하고 그 합을 쓴다. 합계에서 다시 반올림하지 않는다"
    why: "사람이 회계 규정으로 확인해 줌. 팀 지식 vat-per-line-floor.md와 같음"
    by: human
  - what: "CN-0112 기대 환불 합계는 19,180원이다"
    why: "사람이 회계팀 계산값으로 알려 줌 (현재 19,182원)"
    by: human
  - what: "금액 할인 줄 부분 반품 시 할인을 수량 비율로 나누는 방식은 바꾸지 않는다"
    why: "사람이 회계팀과 맞춘 방식이라고 함"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "팀 지식 항목 두 개는 기준 브랜치에 없다(앞 Work w-20261004-001, 머지 대기). 앞 Work에서 고쳤을 수 있음, 머지 대기. 지금 브랜치에는 sumLineVat가 없고 부가세는 creditTotals에서 합계에 한 번 반올림한다"
recommended_next: null
knowledge_candidates:
  - "반품 전표에서 금액 할인 줄을 일부만 반품할 때 할인을 수량 비율로 나누는 방식(returnedDiscount, 원 단위 반올림)은 회계팀과 맞춘 것이다 (사람)"
  - "CN-0112(INV-2047 반품) 환불 합계는 회계팀 계산 19,180원이다. 부가세를 합계에서 한 번 반올림하면 19,182원이 되어 어긋난다 (사람)"
---
## 요약
의도 초안을 고쳤다. CN-0112 기대 합계 19,180원, 줄마다 버림한 부가세의 합, 금액 할인 분할 방식 유지를 반영했다.
## 다음 task가 알아야 할 것
- 대상: `src/invoice/credit-note.js`의 `creditTotals`(부가세 계산). `returnedDiscount`는 바꾸지 않는다
- 재현 입력: `examples/CN-0112.json`, `examples/INV-2047.json`. 현재 19,182원, 기대 19,180원
- 테스트: `npm test` (node --test), 반품 테스트는 `test/credit-note.test.js`
- 원인은 확인하지 않았다. 참고: 지금 `creditTotals`는 과세 합계에 한 번 `Math.round`한다
- 참고 팀 지식: docs/knowledge/invoice/vat-per-line-floor.md, docs/knowledge/invoice/issued-invoice-stored-totals.md (둘 다 기준 브랜치에 없음)

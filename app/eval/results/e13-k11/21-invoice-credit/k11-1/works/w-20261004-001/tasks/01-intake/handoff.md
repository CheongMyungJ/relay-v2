---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 줄마다 원 단위 버림으로 계산해 합산하고, 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄마다 적용한다"
    why: "회계팀 규칙을 사람이 알려 줌. INV-2031 기대 합계 29,079원"
    by: human
assumptions:
  - "INV-2031의 모든 줄이 과세이고 부가세율 10%라고 가정하면 줄별 버림 합 2,641원, 합계 29,079원이 회계팀 값과 일치한다 (코드로 확인하지 않음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "총액 기준 반올림 부가세를 쓰는 다른 곳(크레딧노트, 내보내기, 서식 등)이 있을 수 있어 fix에서 영향 확인 필요"
recommended_next: null
knowledge_candidates:
  - "부가세는 품목 줄마다 원 단위 버림으로 계산해 합산하고 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄마다 적용하고 부가세는 할인된 줄 금액에 매긴다 (사람)"
  - "이미 발행된 청구서는 다시 계산하지 않고 저장된 합계를 쓴다 (사람)"
---
## 요약
청구서 합계가 회계팀보다 크게 나오는 문제의 intent 초안을 썼다. 회계팀 규칙(줄별 부가세 버림 합산)을 원하는 결과로 적었다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`: 현재 `vat = Math.round(taxable * VAT_RATE_PERCENT / 100)` 로 전체 과세분에 한 번 반올림 (참고용, 원인 확정 아님)
- INV-2031: 공급가액 26,438원, 현재 29,082원, 회계팀 29,079원. 줄별 net 5368/6335/3255/8375/3105
- `src/money.js`, `src/invoice/discount.js`, `src/invoice/credit-note.js`도 부가세 계산 사용 여부 확인 필요
- 테스트: `npm test` (node --test)

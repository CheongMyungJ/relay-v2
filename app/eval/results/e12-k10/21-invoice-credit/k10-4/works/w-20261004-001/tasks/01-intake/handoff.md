---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 과세 품목 줄마다 원 단위 버림 후 합산하고, 합계에서 다시 반올림하지 않는다"
    why: "회계팀 규칙을 사람이 알려 줌. INV-2031 회계팀 합계 29,079원"
    by: human
  - what: "반품 전표의 부가세도 같은 규칙으로 맞춘다"
    why: "사람이 '같은 규칙 적용'을 선택"
    by: human
assumptions:
  - "줄별 부가세는 할인 적용 후 공급가액(net) 기준이다 (사람이 말한 규칙)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표는 원 청구서의 부가세와 줄 단위로 대응하므로, 부분 반품 시 원 청구서 부가세와 합이 어긋나는지 fix에서 확인 필요"
recommended_next: null
knowledge_candidates:
  - "부가세 규칙: 과세 품목 줄마다 (할인 후 줄 금액 × 세율)을 원 단위 버림하고 그 합을 부가세로 쓴다. 합계에서 다시 반올림하지 않는다. 청구서와 반품 전표 모두 적용 (사람)"
  - "회계팀 대조값: INV-2031 합계 29,079원 (사람)"
---
## 요약
청구서 부가세를 줄별 버림 합산으로 바꾸고 반품 전표도 같게 맞추는 intent 초안을 썼다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js:29`: `Math.round((taxable * VAT_RATE_PERCENT) / 100)`가 합계 기준 반올림. 줄별 계산이 필요하다.
- `src/invoice/credit-note.js:90`: 반품 전표도 같은 방식의 `Math.round`.
- `src/invoice/total.js`의 `lineAmounts`가 줄별 `net`, `taxable`을 이미 제공한다.
- INV-2031 계산: 공급가액 26,438원, 현재 부가세 2,644원(반올림), 기대 2,641원, 합계 29,079원.
- 테스트: `npm test`(`node --test`), 관련 `test/total.test.js`, `test/credit-note.test.js`.
- 발행 청구서는 `totals`를 저장해 쓰므로(`src/invoice/invoice.js:35`) 재계산 경로가 없는지 확인.

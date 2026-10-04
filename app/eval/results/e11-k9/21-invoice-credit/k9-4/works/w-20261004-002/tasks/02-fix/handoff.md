---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "lineVat을 src/invoice/total.js에 새로 만들고 creditTotals만 사용하게 함"
    why: "팀 지식 docs/knowledge/invoice/vat-per-line-floor.md: 계산은 lineVat 한 곳. 이 브랜치에는 lineVat이 없고 computeTotals 변경은 비목표"
    by: ai
assumptions:
  - "회계팀 기준은 팀 지식의 품목별 버림 합산이라고 가정함 (CN-0112 기대값 19,180원)"
rejected:
  - "returnedDiscount 반올림이 원인: CN-0112에서는 청구서와 같은 규칙이고 금액 할인은 전량 반품이라 영향 없음"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 lineVat을 만들고 computeTotals를 고쳤을 수 있음, 머지 대기. 머지 때 total.js의 lineVat이 충돌할 수 있어 하나로 합쳐야 함"
  - "computeTotals는 아직 Math.round 합계 기준이라 청구서 부가세는 그대로임(비목표)"
  - "금액 할인의 부분 반품 분할(returnedDiscount)은 Math.round 그대로, 규칙 미정"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 부가세를 줄마다 원 단위 버림 후 합산하도록 고쳤다. CN-0112 환불 합계가 19,182원에서 19,180원이 되었다. 재현 테스트 추가, `npm test` 48개 통과.
## 다음 task가 알아야 할 것
- 원인: `src/invoice/credit-note.js` `creditTotals`의 `Math.round(taxable*10/100)`
- 수정: `src/invoice/total.js`의 `lineVat(row, zeroRated)` 추가, creditTotals가 합산
- 테스트: `test/credit-note.test.js` 끝의 2개 추가. 기존 테스트 변경 없음
- 머지 시 앞 Work의 lineVat과 충돌 가능

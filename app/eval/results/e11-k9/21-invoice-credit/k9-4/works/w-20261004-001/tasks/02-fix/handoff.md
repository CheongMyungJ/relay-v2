---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표(creditTotals)도 품목별 버림으로 함께 고친다"
    why: "사람이 범위 확장 질문에 답하고 회계 규정(품목별 버림, 합계 재반올림 없음, 할인은 줄마다 먼저 적용)을 다시 확인함"
    by: human
  - what: "버림은 `Math.floor(net * 10 / 100)`, 할인 적용 후 줄 공급가액 기준"
    why: "사람의 규정 설명과 intake 가정이 일치"
    by: human
assumptions:
  - "공급가액이 음수인 줄은 없다고 가정 (Math.floor)"
rejected:
  - "발행된 청구서 재계산 우려: invoiceTotals와 creditNoteTotals가 저장된 합계를 쓰므로 해당 없음"
open_questions: []
intent_deviation: null
risks:
  - "반품 전표 수정은 intent 범위를 넓힌 것이다. 기존 CN 전표는 저장된 합계를 쓰므로 영향 없음"
  - "export/ledger는 저장 합계를 쓰는 경로라 직접 확인한 것은 테스트 통과뿐"
recommended_next: null
knowledge_candidates:
  - "부가세는 과세 품목 줄마다 할인 적용 후 공급가액에 10%를 곱해 원 단위 버림하고 합산한다. 합계에서 다시 반올림하지 않는다. 청구서와 반품 전표 모두 같다 (사람)"
  - "부가세 계산은 `lineVat` (src/invoice/total.js) 한 곳에 둔다. 청구서(computeTotals)와 반품 전표(creditTotals)가 함께 쓴다"
---
## 요약
부가세를 합계 기준 반올림에서 과세 품목별 원 단위 버림 합산으로 바꿨다. INV-2031은 vat 2,641, total 29,079가 된다. 반품 전표도 사람 결정에 따라 같은 규칙으로 맞췄다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `lineVat`, `computeTotals`; `src/invoice/credit-note.js` `creditTotals`
- 발행 청구서와 전표는 저장 합계를 그대로 씀 (`invoice.js` `invoiceTotals`, `creditNoteTotals`)
- `npm test`: 49 통과. 수정 전 새 테스트 3개 실패 확인
- `src/format/` 변경 없음

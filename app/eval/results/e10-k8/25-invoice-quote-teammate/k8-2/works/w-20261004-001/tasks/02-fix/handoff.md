---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "줄별 버림 계산을 `lineVatSum` 도우미 하나로 묶어 청구서·반품 전표·견적이 함께 쓴다"
    why: "세 곳이 같은 규칙이어야 어긋나지 않음 (intent)"
    by: ai
assumptions:
  - "부가세 계산 시 줄 금액(net)은 항상 0 이상이라 Math.floor가 버림과 같다"
rejected:
  - "발행 청구서 재계산 경로: invoiceTotals와 creditNoteTotals가 저장된 totals를 먼저 쓴다"
open_questions: []
intent_deviation: null
risks:
  - "옛 규칙으로 발행된 청구서의 반품 전표는 부가세가 청구서와 1~2원 어긋날 수 있음"
  - "이미 저장된 견적 totals는 다시 계산하지 않았음"
recommended_next: null
knowledge_candidates:
  - "부가세 계산은 src/invoice/total.js의 lineVatSum(줄별 원 단위 버림 합) 하나로 청구서·반품 전표·견적이 함께 쓴다"
---
## 요약
부가세를 줄별 버림 합으로 바꿔 INV-2031이 29,079원(부가세 2,641원)이 된다. 반품 전표와 견적도 같은 도우미를 쓴다. 테스트 7개 추가, 전체 55개 통과.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `lineVatSum(rows, zeroRated)`가 공통 계산. 호출: `computeTotals`, `creditTotals`, `quoteTotals`.
- 새 테스트: `test/vat-per-line.test.js`. 수정 전 4개 실패 확인.
- 명령: `npm test` (55 통과). `src/format/` 변경 없음.

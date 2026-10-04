---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "줄별 버림은 `Math.floor(net * 세율 / 100)`로 하고 청구서와 반품 전표가 같은 헬퍼(`sumLineVat`)를 쓴다"
    why: "intent의 규칙을 한 곳에 두어 두 경로가 어긋나지 않게 함"
    by: ai
assumptions:
  - "줄 공급가액(net)은 0 이상이다 (음수 줄은 확인하지 않음)"
rejected:
  - "할인 처리 오류: 할인은 줄마다 net에 이미 반영되어 있음"
  - "발행 청구서 재계산: invoiceTotals와 creditNoteTotals는 저장된 totals를 그대로 씀"
open_questions: []
intent_deviation: null
risks:
  - "반품 전표의 줄별 버림 합은 원 청구서 부가세와 부분 반품 시 1원 단위로 어긋날 수 있음 (확인하지 않음)"
  - "이미 발행된 청구서는 옛 방식의 totals를 유지하므로 신규와 기존 값이 섞임 (의도된 비목표)"
recommended_next: null
knowledge_candidates:
  - "부가세 규칙: 과세 품목 줄마다 (할인 후 줄 금액 × 세율)을 원 단위 버림하고 그 합을 부가세로 쓴다. 합계에서 다시 반올림하지 않는다. 청구서와 반품 전표 모두 적용 (사람)"
  - "부가세 계산 위치: src/invoice/total.js의 lineVat/sumLineVat. 청구서와 반품 전표가 공유"
---
## 요약
부가세를 줄별 버림 합산으로 바꿨다. INV-2031은 vat 2,641, 합계 29,079원이다. 반품 전표도 같다. `npm test` 49개 통과.
## 다음 task가 알아야 할 것
- `src/invoice/total.js`: `lineVat`, `sumLineVat`. `computeTotals`와 `src/invoice/credit-note.js`의 `creditTotals`가 사용
- 추가 테스트 3개: test/total.test.js 2개, test/credit-note.test.js 1개. src만 되돌리면 3개 실패 확인
- `src/format/`, 저장된 totals 경로는 건드리지 않음
- 기존 테스트 변경 없음

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 차단·권장(견적·반품 전표 부가세)만 반영하고 사소한 1건은 반영하지 않는다"
    why: "사람이 '차단·권장만 반영'을 골랐다"
    by: human
assumptions:
  - "견적·반품 전표도 청구서와 같은 줄별 버림 규칙을 쓴다고 보고 반영했다. 사람이 반영을 골랐다"
rejected:
  - "total.js 과세 줄 이중 filter 정리: 사소하고 동작 영향이 없어 반영하지 않음"
open_questions: []
intent_deviation: null
risks:
  - "견적·반품 전표 변경은 원래 의도 밖이나 사람이 반영을 골랐다. 이미 저장된 견적·반품 전표 합계는 옛 값 그대로다"
  - "반품 전표 부분 반품의 금액 할인 안분은 바꾸지 않았다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 3건 중 견적·반품 전표 부가세 2건을 반영(커밋 bc008ff)했다. 완료조건 6개 모두 통과, `npm test` 52개 통과, INV-2031은 29,079원이다.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없었다
새 지식: docs/knowledge/invoice/issued-totals-are-stored.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없었다
새 지식: docs/knowledge/format/output-frozen.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없었다
## 다음 task가 알아야 할 것
- 부가세 계산: `src/invoice/total.js` lineVat, `quote.js:42`, `credit-note.js:90`
- 테스트 명령: `npm test`, 재현: `node src/cli.js examples/INV-2031.json --totals`
- 저장된 합계는 재계산하지 않는다(`invoiceTotals`, `creditNoteTotals`)

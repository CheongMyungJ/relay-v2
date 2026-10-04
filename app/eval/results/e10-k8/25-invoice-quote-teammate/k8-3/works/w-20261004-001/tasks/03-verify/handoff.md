---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 중 차단·권장만 반영 (견적·반품 전표에도 줄별 버림 적용), 사소한 지적은 반영하지 않음"
    why: "사람이 선택"
    by: human
assumptions:
  - "견적·반품 전표도 청구서와 같은 줄별 버림 규칙을 따라야 한다고 사람이 반영을 골랐다"
rejected:
  - "영세율 경로 테스트 추가: 사소한 지적이라 사람이 반영하지 않기로 함"
open_questions: []
intent_deviation: null
risks:
  - "견적·반품 전표 변경은 intent 목표(청구서)를 넘는 범위 확장이며 새로 만드는 금액이 몇 원 달라질 수 있음"
  - "초안 청구서 합계는 재계산되어 값이 바뀜. 발행된 것은 저장 합계로 불변"
recommended_next: null
knowledge_candidates: []
---
## 요약
완료조건 6개 모두 통과. INV-2031은 vat 2,641 / total 29,079이고 `npm test` 52개가 통과한다. 지적 1을 반영해 견적·반품 전표도 `lineVat`를 쓴다.
새 지식: docs/knowledge/billing/vat-per-line-floor.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없었다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `lineVat`(export): 줄별 버림. `quote.js`, `credit-note.js`가 사용.
- 커밋: 07c2ebc(견적·반품 전표), 89b8ab2(지식).
- 테스트 명령 `npm test` → 52 pass.

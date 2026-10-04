---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(반품 전표 저장 totals 테스트 추가)만 반영, 2(사소)는 반영하지 않음"
    why: "사람이 차단·권장만 반영을 고름"
    by: human
assumptions: []
rejected:
  - "지적 2: Math.floor의 net ≥ 0 가정 주석 — 사람이 반영하지 않기로 함"
open_questions: []
intent_deviation: null
risks:
  - "옛 규칙으로 발행된 청구서의 반품 전표는 부가세가 청구서와 1~2원 어긋날 수 있음"
  - "이미 저장된 견적 totals는 다시 계산하지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건 중 권장 1건(반품 전표 저장 totals 테스트)을 반영했다. 완료조건 10개 모두 통과, `npm test` 56 통과. 재현(INV-2031)은 2,641원/29,079원.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 맞는 기존 항목이 없는 까닭: docs/knowledge가 비어 있었음
새 지식: docs/knowledge/invoice/issued-totals-and-format.md — 맞는 기존 항목이 없는 까닭: docs/knowledge가 비어 있었음
## 다음 task가 알아야 할 것
- 공통 계산: `src/invoice/total.js` `lineVatSum`. 테스트: `test/vat-per-line.test.js`(8개).
- 명령: `npm test` (56 통과). `src/format/` 변경 없음.
- 커밋: 33984ca(테스트), 지식 커밋.

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 creditTotals의 부가세도 줄별 floor 합산으로 고침"
    why: "사람이 같은 회계 규정이라며 범위에 포함해 달라고 함"
    by: human
assumptions:
  - "리뷰 지적이 없어 사람에게 반영 선택을 묻지 않음"
  - "intent는 갱신되지 않아 비목표(total.js 외 수정 안 함)와 어긋남. 사람 요청이 우선이라 보고 intent_deviation에 적음"
rejected: []
open_questions: []
intent_deviation:
  summary: "사람 요청으로 비목표인 total.js 밖의 src/invoice/credit-note.js를 수정함"
  evidence: "커밋 a0bf63b, 사람이 반품 전표 부가세도 포함해 달라고 함"
risks:
  - "이미 저장된 반품 전표 totals는 그대로라 기존 전표와 청구서 부가세 불일치 건은 남음"
  - "draft·미발행 청구서의 합계는 새 규칙으로 바뀜"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 없음. 완료조건 8개 모두 통과: INV-2031 total 29,079원을 직접 재현했고 `npm test` 50개가 통과한다. 사람 요청으로 반품 전표 `creditTotals`도 줄별 floor로 고쳤다. CN-0112는 부가세 1,744 → 1,742원, 합계 19,182 → 19,180원. 바뀐 테스트 파일 2개는 추가만 있어 약화 아님. `src/format/` 변경 없음. pr.md를 썼다.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 청구서·반품 전표 부가세 줄별 버림 규칙, 맞는 기존 항목 없음 (creditTotals를 고쳐 미준수 절은 뺌)
새 지식: docs/knowledge/invoice/issued-invoice-and-format-output.md — 발행분 저장 합계 사용과 src/format/ 불변 규칙, 맞는 기존 항목 없음
## 다음 task가 알아야 할 것
- `src/invoice/total.js:26-29`: 줄별 floor 합산
- `src/invoice/credit-note.js:90-93`: 반품 전표도 줄별 floor 합산
- 재현은 INV-2047을 `issueInvoice` 후 `createCreditNote`로 CN-0112 계산
- 재현: `createInvoice`로 `examples/INV-2031.json`을 읽어 `invoiceTotals` 호출

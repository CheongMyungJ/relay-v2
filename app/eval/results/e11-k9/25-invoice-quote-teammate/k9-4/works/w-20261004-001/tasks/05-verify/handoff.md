---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 없음, 반영할 지적 없음"
    why: "변경이 원인과 의도에 맞고 재현·테스트가 통과함"
    by: ai
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "견적서 부가세가 줄별 내림이라 이미 안내한 견적과 몇 원 달라질 수 있음"
  - "저장된 totals가 없는 반품 전표·초안 청구서는 새 규칙으로 다시 계산됨"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 없이 모든 완료조건 통과. 재현 3건과 `npm test` 51개를 직접 다시 실행해 확인했다. 테스트 파일 변경은 모두 추가뿐이다.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 맞는 기존 항목이 없음
새 지식: docs/knowledge/invoice/issued-invoice-totals-stored.md — 맞는 기존 항목이 없음
새 지식: docs/knowledge/invoice/format-output-unchanged.md — 맞는 기존 항목이 없음
## 다음 task가 알아야 할 것
- 부가세 계산은 `src/invoice/vat.js`의 `lineVat`/`sumLineVat`
- 재현: `node src/cli.js examples/INV-2031.json --totals` → 29079
- 테스트: `npm test` (51개)

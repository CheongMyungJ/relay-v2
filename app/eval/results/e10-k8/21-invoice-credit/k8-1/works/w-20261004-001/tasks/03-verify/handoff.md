---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건 중 1번(반품 전표 테스트 보강)만 반영, 2번(lineVat 위치)은 반영하지 않음"
    why: "사람이 1번만 반영하기로 고름"
    by: human
assumptions:
  - "일부 반품 시 줄 단위 재계산 값이 회계 규정에 맞다고 본다"
rejected:
  - "lineVat을 total.js 밖으로 옮기기: 사소하고 순환이 없어 사람이 반영하지 않기로 함"
open_questions: []
intent_deviation: null
risks:
  - "일부 반품 시 반품 줄 부가세가 원 청구서 줄 부가세의 수량 비율과 1원 차이날 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 2건(모두 사소) 중 1번을 반영해 반품 전표 테스트 2개를 추가했다. 완료조건 7개 모두 통과, `npm test` 52 pass. 테스트 파일 변경은 모두 추가만이라 약화 아님.
새 지식: docs/knowledge/accounting/vat-per-line-floor.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없음
새 지식: docs/knowledge/invoice/issued-totals-are-stored.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없음
## 다음 task가 알아야 할 것
- 재현: `node src/cli.js examples/INV-2031.json --totals` → vat 2641, total 29079
- 규칙 위치: `src/invoice/total.js:16` `lineVat`, `credit-note.js` `creditTotals`
- 커밋: d4cd2b8(수정), 78921e9(테스트 보강, 지식)
- `src/format/` 변경 없음

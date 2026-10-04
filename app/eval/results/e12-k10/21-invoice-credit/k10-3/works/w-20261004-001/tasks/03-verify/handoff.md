---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "INV-2031의 모든 줄이 과세이고 세율 10%"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표 creditTotals는 합계 기준 반올림이라 청구서와 1원 차이가 날 수 있음(회계팀 확인 후 결정)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 없음. 완료조건 6개 모두 통과(`npm test` 48개 통과, INV-2031 합계 29,079원). 바뀐 테스트 파일은 추가만 있어 약화 아님. `pr.md` 작성.
새 지식: docs/knowledge/billing/vat-calculation.md — 부가세 계산 규칙을 다루는 기존 항목이 없음(반품 전표 규칙은 `## 아직 정하지 않은 것`에 기록)
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js` `computeTotals`의 `vat`
- 재현: `node src/cli.js examples/INV-2031.json --totals` → vat 2641, total 29079
- 반품 전표 `src/invoice/credit-note.js:90`은 미수정

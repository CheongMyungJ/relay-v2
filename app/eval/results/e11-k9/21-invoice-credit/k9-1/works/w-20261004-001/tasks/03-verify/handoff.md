---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표 src/invoice/credit-note.js:90은 여전히 합계에 한 번 반올림한다. 청구서 부가세와 몇 원 어긋날 수 있다 (사람이 범위에서 뺌)"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 없었다. 재현(INV-2031 합계 29,079원)과 `npm test` 49개 통과를 직접 다시 확인했고 완료조건 7개 모두 통과다. 테스트 파일 변경은 추가만 있어 약화 아님.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 맞는 기존 항목이 없는 까닭: 기존 지식 항목이 없음
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js`의 `lineVat`, `computeTotals`.
- 반품 전표 `src/invoice/credit-note.js:90`은 규칙 미적용. 지식 항목의 `## 아직 규칙을 따르지 않는 곳`에 적음.
- 실행: `npm test`.

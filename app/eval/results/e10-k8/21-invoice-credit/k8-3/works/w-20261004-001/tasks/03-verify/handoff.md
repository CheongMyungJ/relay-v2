---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "반품 전표(src/invoice/credit-note.js:90)는 합계 반올림이라 청구서와 1~3원 어긋날 수 있다. 사람이 범위 밖으로 정함"
  - "CSV, 분개, 월별 요약은 새로 계산하는 청구서부터 값이 바뀐다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 없음. 완료조건 6개 모두 통과(재현 절차 29,079원, npm test 50개 통과, 테스트는 추가만, src/format 변경 없음). pr.md를 썼다.
새 지식: docs/knowledge/invoice/vat-per-line-floor.md — 부가세 줄별 절사 규칙과 반품 전표 미반영 기록, 맞는 기존 항목이 없음
새 지식: docs/knowledge/invoice/issued-invoice-totals-frozen.md — 발행 청구서는 저장된 totals를 쓴다는 규칙, 맞는 기존 항목이 없음
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `lineVatSum`: 줄별 `Math.floor(net*10/100)` 합
- `test/total.test.js` 끝의 테스트 4개
- 반품 전표 `src/invoice/credit-note.js:90`은 아직 합계 반올림

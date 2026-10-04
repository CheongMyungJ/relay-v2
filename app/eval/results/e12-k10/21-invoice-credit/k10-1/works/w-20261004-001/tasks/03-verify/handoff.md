---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 2건(사소)을 반영하지 않음"
    why: "사람이 반영하지 않음을 선택"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "저장된 합계가 있는 기존 청구서와 전표는 새 계산과 다를 수 있다 (비목표)"
  - "음수 공급가액 줄은 Math.floor로 0에서 먼 쪽으로 내림한다"
  - "저장소 밖 임시 파일 /p.patch가 남아 있다. 사람이 지워도 된다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 2건이며 반영하지 않았다. 완료조건 7개 모두 통과, 테스트 파일 변경은 추가만이라 약화 아님. `npm test` 49개 통과, INV-2031 합계 29,079원.
새 지식: docs/knowledge/billing/vat-per-line-floor.md — 맞는 기존 항목이 없음
## 다음 task가 알아야 할 것
- 변경: `src/money.js` `floorPercentOf`, `src/invoice/total.js:26`, `src/invoice/credit-note.js:90`
- 지식 문서에 음수 공급가액 처리를 미정으로 적었다

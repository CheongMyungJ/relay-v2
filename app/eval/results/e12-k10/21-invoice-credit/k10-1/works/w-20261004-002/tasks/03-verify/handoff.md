---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(사소, 부가세 식 가독성)은 반영하지 않는다"
    why: "동작·규칙 문제가 아니고 머지 뒤 floorPercentOf로 바꿀 때 다시 고쳐진다"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: floorPercentOf 도우미와 청구서 합계 total.js의 Math.round"
  - "음수 공급가액 줄의 부가세는 미정이고 지금은 Math.floor다"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 1건뿐이고 사람이 반영하지 않기로 했다. 완료조건 7개 모두 통과했다. CN-0112 재현은 부가세 1,742원, 합계 19,180원이고 `npm test`는 49개 통과다.
고친 지식: docs/knowledge/billing/vat-per-line-floor.md — 반품 전표 대조 기준(CN-0112)과 `creditTotals`의 음수 줄 미정 상태를 더했다. 앞 Work의 내용은 모두 살렸다.
## 다음 task가 알아야 할 것
- 수정 위치: `src/invoice/credit-note.js:91` `creditTotals`의 vat.
- 테스트 변경: `test/credit-note.test.js` 추가만, 약화 아님.
- 머지 뒤 인라인 식을 `floorPercentOf`로 바꿀 수 있다.

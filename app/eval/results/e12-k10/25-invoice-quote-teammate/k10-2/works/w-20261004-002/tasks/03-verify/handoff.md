---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(사소, 테스트의 상대경로)은 반영하지 않는다"
    why: "사람이 반영하지 않음을 선택"
    by: human
assumptions: []
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 청구서·견적서를 고쳤을 수 있음, 머지 대기. 이 브랜치에서는 여전히 합계 기준 반올림"
  - "lineVat을 이 Work에서 새로 추가함. 앞 Work와 머지 때 src/invoice/total.js 충돌 가능"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 1건(반영 안 함). 모든 완료조건이 통과했다. CN-0112는 vat 1,742 / total 19,180, `npm test` 50개 통과. 바뀐 테스트 파일은 추가뿐이라 약화 아님.
남긴 지식: 없음 (팀 지식 vat-per-line-floor.md가 이미 반품 전표를 규칙으로 포함하고, 이 Work에서 새로 알게 된 규칙이나 사람 말이 없음)
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `lineVat(net)`, `src/invoice/credit-note.js` `creditTotals`
- 테스트: `npm test`, 새 테스트는 `test/credit-note.test.js` 끝
- 산출물: `verification.md`, `pr.md`

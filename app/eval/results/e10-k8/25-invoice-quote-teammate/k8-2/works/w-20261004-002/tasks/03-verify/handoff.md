---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(lineVatSum 경계 케이스 테스트)만 반영, 2는 반영하지 않음"
    why: "사람이 '1번만 반영'을 골랐다"
    by: human
assumptions: []
rejected:
  - "지적 2(음수 net의 floor): 현재 net은 항상 0 이상이라 조치 불필요"
open_questions: []
intent_deviation: null
risks:
  - "`computeTotals`(청구서)와 `quoteTotals`(견적)는 아직 한 번 반올림이라 반품 전표와 규칙이 다르다(비목표)"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: `src/invoice/total.js` 충돌 가능"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적 1건(권장)을 반영해 테스트를 추가했고, 모든 완료조건이 통과했다. `npm test` 51건 통과, CN-0112 환불 합계 19,180원을 직접 확인했다. `src/format/` 변경 없음.
고친 지식: docs/knowledge/invoice/vat-per-line-floor.md — CN-0112 예, 반품 전표 적용, 아직 따르지 않는 곳(청구서·견적) 추가
## 다음 task가 알아야 할 것
- `src/invoice/total.js:30-34` `lineVatSum`, `src/invoice/credit-note.js` `creditTotals`에서 사용
- 테스트 추가 커밋 fe1c172, 지식 커밋은 그 뒤
- 변경된 테스트 파일은 test/credit-note.test.js뿐이며 약화 아님

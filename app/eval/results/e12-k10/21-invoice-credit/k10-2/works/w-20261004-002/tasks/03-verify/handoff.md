---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "사소 지적 1(테스트 이름과 면세 단언)을 반영하지 않는다"
    why: "사람이 반영하지 않음을 골랐다"
    by: human
assumptions:
  - "회계팀이 기대하는 CN-0112 값은 규칙대로 계산한 19,180원이다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "회계팀의 CN-0112 기대값을 직접 확인하지 못했다"
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기. 지식 파일 vat-per-line-floor.md가 같은 경로라 머지 때 겹칠 수 있음"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰에서 사소 지적 1건(테스트 이름·면세 단언)이 나왔고 사람이 반영하지 않기로 했다. 완료조건 8개 모두 통과했다. `npm test` 49 통과, CN-0112 재현은 vat 1742 / total 19180이다.
고친 지식: docs/knowledge/invoice/vat-per-line-floor.md — 앞 Work의 내용을 살려 같은 경로에 쓰고, credit-note.js를 규칙대로 고쳤다는 이력과 반품 전표 적용 예(CN-0112)를 더했다
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals`의 vat 줄(90줄 근처)
- 테스트: `test/credit-note.test.js` 끝 3개. 수정 전 src로 되돌리면 2건 실패
- 변경된 테스트 파일은 약화 아님
- 커밋: 지식 파일 커밋 포함

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 전표 부가세를 credit-note.js 안의 lineVat으로 줄별 버림 계산"
    why: "팀 지식 docs/knowledge/credit-note-same-vat-rule.md. 기준 브랜치의 total.js에는 vatOfRows가 없고 total.js 변경은 비목표"
    by: ai
assumptions:
  - "회계팀 기대값은 줄별 버림 규칙과 같다고 보았다(요청에 회계팀 금액 없음)"
  - "할인 반올림(percentOf)은 그대로 둔다. CN-0112 부가세에는 영향 없음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261003-001)에서 total.js를 고쳤을 수 있음, 머지 대기. 머지 뒤 vatOfRows와 중복되므로 합치는 것을 검토"
  - "기준 브랜치의 청구서 total.js는 아직 합계 반올림 방식이라 청구서와 반품 전표 부가세가 어긋날 수 있음(비목표라 그대로 둠)"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 부가세를 줄별 원 단위 버림 후 합산으로 고쳤다. CN-0112는 부가세 1,744원/합계 19,182원에서 1,742원/19,180원이 됐다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js`의 `lineVat`, `creditTotals`
- 테스트: `npm test` 49개 통과, 추가 테스트는 `test/credit-note.test.js` 끝부분
- 저장된 totals는 재계산하지 않음

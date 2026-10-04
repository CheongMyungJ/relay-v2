---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 과세 줄마다 원 미만 절사 후 합산하는 방식으로 고친다"
    why: "팀 지식 docs/knowledge/invoice/vat-per-line-floor.md"
    by: ai
  - what: "total.js에 lineVat(net)을 새로 추가해 반품 전표에서 쓴다"
    why: "이 브랜치에 lineVat이 없음. 팀 지식이 세 문서 공용으로 정한 위치"
    by: ai
assumptions:
  - "앞 Work의 lineVat 시그니처는 알 수 없어 lineVat(net)으로 정했다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 lineVat을 이미 만들었을 수 있음, 머지 대기. 머지 때 total.js 충돌 가능"
  - "청구서(computeTotals)와 견적서(quoteTotals)는 비목표라 그대로임. 여전히 반올림 방식"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 부가세를 과세 줄마다 절사 후 합산하도록 고쳤다. CN-0112 환불 합계가 19,182원에서 19,180원이 되었다. 재현 테스트를 추가했고 npm test 50개가 통과한다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `lineVat(net)` 추가, `src/invoice/credit-note.js` `creditTotals`에서 사용
- 테스트: `npm test`, 새 테스트는 `test/credit-note.test.js` 끝

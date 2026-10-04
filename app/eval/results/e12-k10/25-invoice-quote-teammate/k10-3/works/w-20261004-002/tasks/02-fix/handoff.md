---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "lineVat을 src/invoice/total.js에 새로 추가하고 creditTotals만 이를 쓰게 했다. computeTotals/quoteTotals는 바꾸지 않았다"
    why: "팀 지식 docs/knowledge/invoice/vat-rule.md의 규칙과 이번 요청 범위(반품 전표). 이 브랜치에는 lineVat이 없었다"
    by: ai
assumptions:
  - "lineVat 시그니처는 앞 Work와 다를 수 있다"
rejected:
  - "returnedDiscount 반올림이 원인: CN-0112 supply 17,438은 이미 회계팀 값과 일치, 차이는 부가세뿐"
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 고쳤을 수 있음, 머지 대기: lineVat이 중복 정의되어 머지 때 충돌할 수 있다"
  - "computeTotals/quoteTotals는 아직 합계 반올림 방식(범위 밖)"
recommended_next: null
knowledge_candidates: []
---
## 요약
반품 전표 부가세를 과세 줄마다 버림해 더하도록 고쳤다. CN-0112 환불 합계는 19,182원에서 19,180원이 됐다. 재현 테스트를 추가했고 npm test 50개가 통과한다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `lineVat`, `src/invoice/credit-note.js` `creditTotals`.
- 테스트: `test/credit-note.test.js` 끝의 새 테스트 2개. 명령 `npm test`.
- 원인: 합계에 Math.round(1,743.8→1,744) 대 줄별 버림 1,742.

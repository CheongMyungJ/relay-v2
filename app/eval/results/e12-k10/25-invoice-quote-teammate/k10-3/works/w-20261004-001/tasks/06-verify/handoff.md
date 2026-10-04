---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "리뷰 지적 1(사소, floorPercentOf 공개 export 추가)은 반영하지 않는다"
    why: "사람이 '반영하지 않음'을 골랐다"
    by: human
assumptions: []
rejected:
  - "floorPercentOf를 src/index.js에 export: 사람이 반영하지 않기로 함"
open_questions: []
intent_deviation: null
risks:
  - "옛 규칙으로 저장된 청구서에 새 규칙 반품 전표를 붙이면 INV-2047 전부 반품 3원, CN-0112 일부 반품 2원 차이. 보정 규칙 없음, 사람이 판단"
  - "quote.js와 credit-note.js가 total.js의 lineVat에 의존"
recommended_next: null
knowledge_candidates: []
---
## 요약
리뷰 지적은 사소 1건이고 반영하지 않았다. 완료조건 9개를 최종 코드에서 모두 통과로 판정했다. `npm test` 54개 통과, INV-2031은 부가세 2,641원, 합계 29,079원이다. 바뀐 테스트 3개 파일은 추가만 있어 약화 아님이다.
새 지식: docs/knowledge/invoice/vat-rule.md — 맞는 기존 항목이 없고 사람이 알려 준 부가세 규칙과 미정 사항(반품 전표 맞물림)을 남김
## 다음 task가 알아야 할 것
- 맞물림 확인 결과: INV-2047 저장 부가세 5,801원, 새 규칙 재계산 5,798원 → 전부 반품 3원 차이. CN-0112 일부 반품(공급가액 17,438원) 새 규칙 1,742원, 옛 규칙 1,744원 → 2원 차이
- 새 규칙으로 발행한 청구서와는 전부 반품 시 부가세가 같다
- 규칙 구현: `src/invoice/total.js` `lineVat`, `src/money.js` `floorPercentOf`
- 테스트: `npm test`

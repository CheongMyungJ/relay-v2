---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "면세 줄과 영세율 청구서는 기존대로 부가세 0"
rejected:
  - "합계 단위 버림: 2,643원, 합계 29,081원이라 회계팀 29,079원과 다름"
open_questions: []
intent_deviation: null
risks:
  - "반품 전표(src/invoice/credit-note.js:90)는 합계 기준 Math.round 그대로라 원 청구서와 부가세가 어긋날 수 있음(비목표)"
recommended_next: null
knowledge_candidates:
  - "회계팀 부가세 규칙: 품목 줄마다 할인 적용 후 금액의 부가세를 원 단위 버림으로 구해 합산한다. 합계에서 다시 반올림하지 않는다 (사람)"
  - "아직 규칙을 따르지 않음: src/invoice/credit-note.js — 부가세를 합계 기준 Math.round로 계산, 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
`src/invoice/total.js`의 부가세를 과세 줄별 버림 합산으로 바꿔 INV-2031 합계가 29,082원에서 29,079원이 되었다. 테스트 2개 추가, `npm test` 48개 통과.
## 다음 task가 알아야 할 것
- 수정 위치: `src/invoice/total.js` vat 계산
- 테스트: `test/total.test.js` 끝의 2개 (수정 전 실패, 후 통과 확인)
- 반품 전표는 손대지 않음

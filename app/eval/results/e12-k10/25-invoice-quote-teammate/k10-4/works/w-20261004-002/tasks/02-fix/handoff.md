---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세를 과세 줄마다 floorPercentOf로 계산해 합산한다"
    why: "팀 지식 docs/knowledge/accounting/vat-rounding.md: 반품 전표도 같은 규정"
    by: ai
  - what: "src/money.js에 floorPercentOf를 새로 추가했다"
    why: "이 브랜치에 없었고 규정이 이 함수명을 지정함"
    by: ai
assumptions:
  - "금액 할인의 수량 비율 반올림(returnedDiscount)은 그대로 둔다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "앞 Work(w-20261004-001)에서 floorPercentOf를 추가했을 수 있음, 머지 대기. money.js 머지 충돌 가능"
  - "quote.js 등 청구서·견적은 비목표라 건드리지 않음"
recommended_next: null
knowledge_candidates: []
---
## 요약
`creditTotals`의 부가세를 합계 한 번 반올림에서 과세 줄별 원 단위 버림 합으로 고쳤다. CN-0112는 부가세 1,742원, 합계 19,180원이 된다. 재현 테스트 추가, `npm test` 50개 통과.
## 다음 task가 알아야 할 것
- `src/invoice/credit-note.js` creditTotals, `src/money.js` floorPercentOf(신규)
- 테스트: test/credit-note.test.js 끝의 2개 추가. 수정 전 실패 확인함
- `src/format/` 변경 없음

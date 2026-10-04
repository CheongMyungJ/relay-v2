---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "반품 부가세를 과세 줄마다 Math.floor 후 합산으로 바꾼다"
    why: "팀 지식 docs/knowledge/invoice/vat-per-line-floor.md의 규칙과 intent 제약"
    by: ai
  - what: "returnedDiscount의 Math.round 안분은 바꾸지 않는다"
    why: "intent가 부가세 규칙만 다루고 할인 반올림 기준이 주어지지 않음"
    by: ai
assumptions:
  - "회계팀 기준 금액은 줄별 버림 방식(CN-0112 1,742원/19,180원)과 같다고 가정함"
rejected:
  - "할인 안분 Math.round가 CN-0112 어긋남의 원인: 해당 줄은 전량 반품이라 안분 없음"
open_questions: []
intent_deviation: null
risks:
  - "비율 할인(percentOf)과 수량 비례 금액 할인의 Math.round는 그대로여서 다른 전표에서 할인액이 1원 다를 수 있음"
  - "청구서 쪽 total.js는 범위 밖이라 합계 기준 Math.round 그대로임(앞 Work w-20261004-001에서 고쳤을 수 있음, 머지 대기)"
recommended_next: null
knowledge_candidates:
  - "반품 전표 부가세(src/invoice/credit-note.js creditTotals)도 줄별 Math.floor 규칙을 따르도록 고침. CN-0112는 부가세 1,742원, 환불 합계 19,180원"
---
## 요약
`creditTotals`가 합계 기준 `Math.round`로 부가세를 구해 CN-0112가 1,744원/19,182원으로 나왔다. 줄마다 floor해 합하도록 고쳐 1,742원/19,180원이 된다. 테스트 2개 추가, `npm test` 48개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/credit-note.js` `creditTotals`. 테스트: `test/credit-note.test.js` 끝의 2개.
- 저장된 `totals`가 있으면 `creditNoteTotals`가 그대로 반환(변경 없음, 테스트 추가).
- `src/format/` 변경 없음. 커밋 1개.

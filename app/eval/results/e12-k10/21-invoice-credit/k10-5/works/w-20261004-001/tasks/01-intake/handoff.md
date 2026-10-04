---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 품목 줄마다 원 단위 버림, 그 합이 청구서 부가세. 합계에서 재반올림 없음. INV-2031 기대 합계 29,079원"
    why: "사람이 회계팀 규정으로 직접 알려 줌"
    by: human
  - what: "비목표: 저장된 발행 청구서 재계산, src/format/ 출력 형식"
    why: "요청 원문과 사람의 선택"
    by: human
assumptions:
  - "반품 전표(credit-note)가 computeTotals를 쓰는지 확인하지 않음. 쓰면 같이 영향받을 수 있음"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "부가세 계산이 total.js 밖(내보내기, 반품 전표, 서식)에서 중복될 수 있음"
recommended_next: null
knowledge_candidates:
  - "회계 규정: 청구서 부가세는 품목 줄마다 원 단위 버림, 그 합이 청구서 부가세이며 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄마다 적용하고 부가세는 할인된 줄 금액에 매긴다 (사람)"
  - "발행된 청구서는 재계산하지 않고 저장된 합계를 쓴다. src/format/ 출력 형식은 PDF 생성기가 그대로 찍으므로 바뀌면 안 된다 (사람)"
---
## 요약
청구서 합계가 회계팀보다 크게 나오는 버그의 intent 초안을 썼다. 기준은 줄별 부가세 버림이다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`: 부가세를 과세 공급가액 합에 `Math.round`로 한 번 계산한다(참고용 관찰, 원인 확정 아님).
- `src/money.js`의 `percentOf`는 반올림이라 그대로 쓰면 안 될 수 있다.
- INV-2031 줄별 부가세: 536, 633, 325, 837, 310 = 2,641원. 합계 29,079원.
- 테스트: `npm test`(node --test), `test/total.test.js`.

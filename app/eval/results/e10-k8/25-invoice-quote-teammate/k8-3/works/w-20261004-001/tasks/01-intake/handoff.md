---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 품목 줄마다 할인 적용 후 금액에 원 단위 버림으로 계산해 합산하고, 합계에서 다시 반올림하지 않는다"
    why: "회계팀 규칙(사람 답변). INV-2031 회계팀 합계 29,079원"
    by: human
  - what: "추가 비목표 없음 (발행 청구서 재계산 금지, src/format/ 불변만)"
    why: "사람 답변"
    by: human
assumptions:
  - "테스트 명령은 package.json의 npm test (node --test)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "percentOf(src/money.js)는 할인 계산에도 쓰이는 반올림 함수라 공용 변경 시 다른 곳이 영향받을 수 있음"
recommended_next: null
knowledge_candidates:
  - "회계팀 부가세 규칙: 할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 줄 금액에 품목 줄마다 원 단위 버림으로 계산해 합산한다. 합계에서 다시 반올림하지 않는다 (사람)"
---
## 요약
청구서 합계가 회계팀보다 큰 버그의 의도 초안을 썼다. 기대 규칙은 줄별 버림 부가세이고 INV-2031 기대 합계는 29,079원이다.
## 다음 task가 알아야 할 것
- 관련 코드: `src/invoice/total.js` computeTotals의 vat 줄(합계 과세분에 `Math.round`), 할인은 `src/invoice/discount.js`의 `percentOf`(반올림).
- INV-2031 줄 공급가액: 5368, 6335, 3255, 8375, 3105 (합 26,438). 줄별 버림 부가세 536+633+325+837+310=2641 → 합계 29,079.
- 참고(미확인): `examples/INV-2031.json` 품목에 `taxType`이 없는데 `isTaxableLine`은 `taxType === 'taxable'`만 과세로 본다. 현재 29,082가 나오는 경로는 fix에서 확인할 것.
- 테스트: `npm test`, 관련 파일 `test/total.test.js`, `test/invoice.test.js`.

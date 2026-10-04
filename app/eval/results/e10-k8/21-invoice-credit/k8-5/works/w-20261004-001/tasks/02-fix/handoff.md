---
status: awaiting_approval
blocked_reason:
decisions: []
assumptions:
  - "현재 세율 10%에서 net*10/100의 부동소수점 오차로 Math.floor 결과가 틀어지는 경우는 없다고 봄 (정수 곱 후 나눗셈)"
rejected:
  - "percentOf 사용 문제: computeTotals는 percentOf를 쓰지 않음"
  - "반품 전표 영향: credit-note.js는 자체 creditTotals를 써서 영향 없고 범위 밖이라 그대로 둠"
open_questions: []
intent_deviation: null
risks:
  - "반품 전표(creditTotals)는 여전히 합계 기준 반올림이라 청구서와 계산 방식이 달라짐 (비목표라 유지)"
  - "발행 전(draft) 청구서의 합계는 달라질 수 있음. 발행된 청구서는 저장된 totals를 그대로 씀"
recommended_next: null
knowledge_candidates:
  - "반품 전표 src/invoice/credit-note.js의 creditTotals는 아직 합계 기준 Math.round 방식이다. 청구서와 계산 방식이 다르다"
---
## 요약
부가세를 줄별 원 단위 버림 후 합산으로 바꿨다. INV-2031은 vat 2,641, 합계 29,079원이다. 테스트 3개를 추가했고 `npm test` 49개가 모두 통과한다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js`: `lineVat`(Math.floor)과 `computeTotals`의 vat 합산.
- 추가 테스트는 `test/total.test.js` 끝부분 3개. 기존 테스트는 바꾸지 않았다.
- `src/format/`은 변경 없음.
- `src/invoice/credit-note.js`의 `creditTotals`는 건드리지 않았다.
- 확인 명령: `npm test`

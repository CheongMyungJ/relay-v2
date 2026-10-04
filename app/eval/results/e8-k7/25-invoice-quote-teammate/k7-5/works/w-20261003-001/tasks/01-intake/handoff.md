---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 과세 품목 줄마다 할인 후 금액에 원 단위 버림으로 계산하고 그 합을 쓴다"
    why: "회계팀 규칙을 사람이 직접 알려 줌. INV-2031 기대 합계 29,079원"
    by: human
  - what: "견적·반품 전표는 이번에 수정하지 않고, 청구서 합계 코드와의 공유 여부만 확인해 알린다"
    why: "사람의 지시"
    by: human
assumptions:
  - "예제 INV-2031의 품목은 taxType 없이 정규화되어 모두 과세로 본다 (정규화 기본값 taxable)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "계산 방식이 바뀌면 이미 발행된 청구서와 새로 계산한 값이 달라질 수 있어 발행분 재계산 금지를 지켜야 한다"
recommended_next: null
knowledge_candidates:
  - "회계팀 부가세 규칙: 품목 줄마다 할인 적용 후 금액에 부가세를 원 단위 버림으로 계산해 합산하고, 합계에서 다시 반올림하지 않는다 (사람)"
  - "이미 발행된 청구서는 재계산하지 않고 저장된 합계를 쓴다. src/format/ 출력 형식은 PDF 생성기가 그대로 찍으므로 바꾸지 않는다 (사람)"
---
## 요약
청구서 부가세를 회계팀 규칙(줄별 원 단위 버림 합산)으로 맞추는 버그 수정 의도 초안을 썼다. INV-2031은 29,082원에서 29,079원이 되어야 한다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js:26`: 현재 `Math.round(taxable * 10 / 100)`로 과세 합계 전체에 한 번 반올림한다. 줄별 계산이 아니다.
- 계산 확인: 줄별 버림 부가세 536+633+325+837+310=2,641, 공급가액 26,438, 합계 29,079.
- 견적 `src/invoice/quote.js:40-44`는 `percentOf`(반올림)를 쓰고, 반품 전표 `src/invoice/credit-note.js:90`은 total.js와 같은 모양의 별도 인라인 계산이다. 공유 함수는 아니다. 같은 문제가 있는지 결과만 알려야 한다.
- `examples/INV-2031.json` 원본은 taxType가 없다. `normalizeLine`을 거쳐야 과세로 계산된다.
- 테스트: `npm test`(node --test), `test/total.test.js`.

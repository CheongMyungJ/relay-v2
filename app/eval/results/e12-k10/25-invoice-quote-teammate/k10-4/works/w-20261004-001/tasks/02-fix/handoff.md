---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세를 과세 품목 줄마다 원 미만 버림해 더하는 규칙으로 고친다"
    why: "29,079원과 맞는 단순 규칙이 이것뿐이다 (줄별 반올림 29,084, 합계 버림 29,081)"
    by: ai
  - what: "견적(quoteTotals)과 반품 전표(creditTotals)에도 같은 줄별 버림 규칙을 적용한다"
    why: "사람 답: 회계 규정은 줄별 버림 합, 견적·반품 전표도 같은 규정이면 맞춘다"
    by: human
assumptions: []
rejected:
  - "줄별 반올림: 부가세 2,646원이라 29,079원과 안 맞음"
  - "합계에 한 번 버림: 29,081원이라 안 맞음"
  - "taxType 누락으로 면세 처리: normalizeLine이 taxable 기본값을 채움"
open_questions: []
intent_deviation: null
risks:
  - "견적·반품 전표 수정은 INV-2031 같은 회계팀 실제 값이 없어 규정 설명 기준이다. 회계/경리 계산과 비교는 사람 몫이다"
  - "견적 규칙이 바뀌어 이미 보낸 견적과 새로 계산한 견적 vat가 1~3원 다를 수 있다"
recommended_next: null
knowledge_candidates:
  - "회계 규정: 부가세는 품목 줄마다 원 단위 버림으로 계산해 그 합을 부가세로 쓰고 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄마다 적용하고 부가세는 할인된 줄 금액에 매긴다. 견적·반품 전표도 같은 규정이다 (사람)"
---
## 요약
부가세를 청구서·견적·반품 전표 모두 줄별 버림으로 통일했다. INV-2031은 29,079원, Q-0457은 56,278원, CN-0112는 19,180원이다. `npm test` 51개 통과, 커밋했다.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js`, `quote.js`, `credit-note.js`의 vat 줄, `src/money.js` `floorPercentOf`.
- 견적은 이전에 할인 전 금액에 부가세를 매겼다. 지금은 할인 후 줄 금액에 매긴다.
- INV-2047은 저장값 63,807원을 쓰고, 다시 계산하면 63,804원이다(적용 안 함).
- `src/format/`은 바뀌지 않았다.

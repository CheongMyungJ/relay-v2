---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "영세율 결함을 quote.js와 total.js 둘 다 고친다"
    why: "사람이 범위를 정함. 같은 원인의 같은 호출 실수이고 실패 테스트가 있음"
    by: human
  - what: "발행된 청구서의 저장 totals, 견적 번호 형식, 유효 기간 계산은 건드리지 않는다"
    why: "사람이 재확인함. 의도의 비목표와 docs/knowledge/billing/issued-invoice-totals-frozen.md"
    by: human
assumptions:
  - "56,280원은 규칙 변경 전 코드로 만든 견적서의 저장값이다. 이미 보낸 견적서는 다시 보내지 않아 재발행은 하지 않는다(사람)"
rejected:
  - "현재 quoteTotals의 할인/버림 계산 오류: 손계산과 일치"
open_questions: []
intent_deviation:
  summary: "Q-0457 합계는 현재 코드에서 이미 56,278원으로 맞다. 요청의 56,280원은 2076df4 이전 코드의 값이다. 이번 코드 수정은 영세율 결함이다"
  evidence: "2076df4~1 실행 시 vat 3589 / total 56280, 현재 3587 / 56278"
risks:
  - "INV-2047은 발행 저장값(5,801 / 63,807)이 줄별 버림 손계산(5,798 / 63,804)과 다르다. 의도된 동결이라 그대로 둠"
recommended_next: null
knowledge_candidates:
  - "영세율 문서 부가세: sumLineVat은 불리언이 아니라 { zeroRated } 객체를 받는다. 불리언을 넘기면 영세율이 조용히 무시된다(quote.js, total.js에서 발생해 수정)"
  - "56,280원은 2076df4 이전(합계 단위 반올림 2회) 견적서 값이고 줄별 버림 기준은 56,278원이다. 이미 보낸 견적서는 재발행하지 않는다 (사람)"
---
## 요약
Q-0457은 현재 코드로 56,278원이라 손계산과 같다. 56,280원은 이전 부가세 방식의 값이었다. 남은 결함인 영세율 문서 부가세 무시(quote.js, total.js가 불리언을 넘김)를 고쳐 실패 테스트 4개를 통과시켰고, 영세율 견적서 테스트를 추가했다. npm test 60개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/quote.js:40`, `src/invoice/total.js:26`
- 새 테스트: `test/vat-per-line.test.js` 마지막 `영세율 견적서의 부가세는 0이다`
- 예시 대조 결과는 fix.md 맨 아래. INV-2031, Q-0457, CN-0112 일치. INV-2047은 저장값 고정이라 5,801 유지
- 견적 번호, 유효 기간 코드는 변경 없음

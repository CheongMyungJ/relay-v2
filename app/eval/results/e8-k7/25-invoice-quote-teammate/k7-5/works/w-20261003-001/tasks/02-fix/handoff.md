---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "줄별 부가세는 Math.floor((net * 세율) / 100)로 계산한다"
    why: "회계팀 규칙(줄별 원 단위 버림). 할인 후 net 기준, 과세 줄만, 영세율은 0"
    by: ai
assumptions:
  - "net(할인 후 공급가액)은 음수가 아니다 (음수면 floor 방향이 달라질 수 있음)"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "quote.js와 credit-note.js는 여전히 반올림 방식이라 같은 청구서 기준 금액과 3원류 차이가 날 수 있다 (비목표라 수정 안 함)"
  - "초안 상태 청구서의 합계는 새 규칙으로 바뀐다. 발행분은 저장 합계를 쓴다"
recommended_next: null
knowledge_candidates:
  - "credit-note.js:90의 부가세는 total.js와 같은 모양의 별도 인라인 반올림 계산이고, quote.js는 percentOf(반올림)를 쓴다. 청구서 부가세 규칙을 바꿀 때 두 곳이 따로 남는다"
---
## 요약
청구서 부가세를 과세 줄별 원 단위 버림의 합으로 바꿨다. INV-2031은 부가세 2,641원, 합계 29,079원이다. `npm test` 51개 통과.
## 다음 task가 알아야 할 것
- 수정: `src/invoice/total.js`의 `lineVat`과 `computeTotals`의 vat 계산
- 테스트: `test/total.test.js` 끝의 3건 추가. 수정 전 2건 실패, 수정 후 통과
- 재현 명령: `node src/cli.js examples/INV-2031.json --totals`
- 견적/반품 전표는 공유 함수 없이 각자 반올림 계산(quote.js:40-44, credit-note.js:90). 수정하지 않음
- 발행분은 `invoiceTotals`(invoice.js:40)가 저장 합계를 써서 영향 없음. `src/format/` 변경 없음

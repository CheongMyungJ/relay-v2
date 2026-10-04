---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "기대 합계는 INV-2031 기준 29,079원이다"
    why: "사람이 회계팀 계산값을 알려 줌 (현재 29,082원, 3원 차이)"
    by: human
  - what: "발행된 청구서는 재계산하지 않고, src/format/은 바꾸지 않는다"
    why: "요청 원문의 제약"
    by: human
assumptions:
  - "예시 INV-2031의 라인에 taxType이 없어 isTaxableLine이 모두 면세로 볼 수 있다. 요청의 29,082원과 맞는지는 확인하지 않았다"
rejected: []
open_questions:
  - "견적·반품 전표에도 같은 반올림 규칙을 적용할지 (사람도 모름, 고친 뒤 예시 비교로 결정)"
intent_deviation: null
risks:
  - "회계팀의 정확한 반올림 규칙은 사람이 말하지 않았다. 29,079원 한 건만 근거다"
recommended_next: null
knowledge_candidates:
  - "발행된 청구서는 다시 계산하지 않고 저장된 합계를 쓴다 (사람)"
  - "src/format/ 출력은 PDF 생성기가 그대로 찍으므로 바꾸지 않는다 (사람)"
---
## 요약
새로 계산하는 청구서의 합계 반올림을 회계팀 계산(INV-2031: 29,079원)에 맞추는 의도를 정리했다. 견적·반품 전표 적용 여부는 미정이다.
## 다음 task가 알아야 할 것
- 계산 위치: `src/invoice/total.js` `computeTotals`의 vat 줄, `src/money.js` `percentOf`.
- 참고용 가설(확인 안 됨): 공급가액 26,438원. 합계 오차 -3원은 부가세를 합계에 한 번(2,644원) 대신 줄마다 내림해 합산(536+633+325+837+310=2,641원)하면 29,079원이 된다.
- 위 가설과 `taxType` 누락 여부는 fix에서 확인한다.
- 확인할 예시: `examples/Q-0457.json`, `examples/CN-0112.json`, `examples/INV-2047.json`.

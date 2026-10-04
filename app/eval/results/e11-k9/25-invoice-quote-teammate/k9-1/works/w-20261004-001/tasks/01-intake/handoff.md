---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 과세 품목 줄마다 원 단위 버림으로 계산해 합하고, 합계에서 다시 반올림하지 않는다"
    why: "사람이 회계팀 계산 방식으로 답함"
    by: human
  - what: "할인은 부가세 전에 줄마다 적용하고, 부가세는 할인된 줄 금액에 매긴다"
    why: "사람이 회계팀 계산 방식으로 답함"
    by: human
  - what: "INV-2031의 기대 합계는 29,079원"
    why: "사람이 회계팀 값으로 답함. 줄별 버림 부가세 합 2,641원과 일치"
    by: human
assumptions:
  - "면세 줄은 부가세 0, 영세율 청구서는 부가세 0을 그대로 유지한다고 봄"
  - "저장된 합계를 쓰는 발행 청구서 경로는 이번 수정이 건드리지 않는다고 봄"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "computeTotals 결과를 쓰는 다른 곳(export, quote, credit-note 등)의 합계도 같이 바뀔 수 있음"
recommended_next: null
knowledge_candidates:
  - "부가세는 과세 품목 줄마다 원 단위 버림으로 계산해 합하고, 합계에서 다시 반올림하지 않는다. 할인은 부가세 전에 줄마다 적용하고 부가세는 할인된 줄 금액에 매긴다 (회계팀 방식) (사람)"
  - "이미 발행된 청구서는 다시 계산하지 않고 저장된 합계를 그대로 쓴다 (사람)"
---
## 요약
청구서 합계가 회계팀보다 큰 문제의 의도를 정리했다. 회계팀 방식은 줄별 부가세 버림 합산이고, INV-2031의 기대 합계는 29,079원이다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js` `computeTotals`: 부가세를 과세 공급가액 합계에 `Math.round`로 한 번 계산한다(줄별 아님). 이것은 사실 확인일 뿐 원인 판정이 아니다.
- INV-2031 현재 값: 공급가액 26,438, 부가세 2,644, 합계 29,082. 기대 부가세 2,641, 합계 29,079.
- 테스트 명령은 `npm test`(`node --test`). 관련 테스트는 `test/total.test.js`.
- 부가세율은 `src/config.js`의 `VAT_RATE_PERCENT`(10).

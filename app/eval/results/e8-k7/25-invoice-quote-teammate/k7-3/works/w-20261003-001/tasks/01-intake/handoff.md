---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 줄별 원 단위 버림 후 합산, 합계에서 재반올림하지 않음. 할인은 부가세 전에 줄마다 적용"
    why: "회계팀 기준을 사람이 알려 줌. INV-2031 회계팀 합계 29,079원"
    by: human
  - what: "발행된 청구서 합계는 저장값을 유지한다"
    why: "요청 원문 제약, 사람이 추천안 선택"
    by: human
assumptions:
  - "영세율과 면세 줄의 부가세 처리는 현재 동작을 유지한다고 가정"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "발행분이 합계를 저장하는지 매번 재계산하는지 확인하지 않음. fix에서 확인 필요"
recommended_next: null
knowledge_candidates:
  - "회계팀 부가세 기준: 품목 줄마다 할인 적용 후 금액에 부가세를 매기고 원 단위 버림, 그 합이 부가세이며 합계에서 재반올림하지 않음 (사람)"
  - "이미 발행된 청구서는 다시 계산하지 않고, src/format/ 출력 형식은 PDF 생성기 때문에 바꾸지 않는다 (사람)"
---
## 요약
INV-2031 합계가 회계팀보다 3원 큰 문제의 의도를 정리했다. 기준은 줄별 버림 부가세의 합이다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js:28`: 현재 부가세는 `Math.round(taxable * VAT_RATE_PERCENT / 100)` 한 번으로 계산함. 원인 확정은 fix에서.
- INV-2031 줄 공급가액 합 26,438원. 줄별 버림 부가세는 536+633+325+837+310=2,641 이고 합계 29,079원으로 회계팀 값과 일치(손계산).
- 테스트: `npm test` (node --test), `test/total.test.js`

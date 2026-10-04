---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 과세 줄마다 할인 적용 후 금액 기준 원 단위 버림, 그 합이 청구서 부가세"
    why: "사람이 회계팀 규칙으로 직접 알려 줌. INV-2031 검산: 536+633+325+837+310=2641, 26438+2641=29079"
    by: human
  - what: "발행된 청구서 재계산 금지, src/format/ 불변을 비목표로 함"
    why: "요청 원문"
    by: human
assumptions:
  - "과세 구분이 면세인 줄과 영세율 청구서는 부가세 0 유지"
  - "청구서 합계 계산(computeTotals)만 이번 범위. 반품 전표는 요청에 없음"
rejected:
  - "합계 기준 절사: 사람이 아니라고 함"
open_questions: []
intent_deviation: null
risks:
  - "src/invoice/credit-note.js:90 도 합계 기준 Math.round로 부가세를 계산함. 같은 규칙을 반품 전표에도 적용할지 요청에 없어 범위에 넣지 않음"
  - "test/total.test.js의 기존 기대값 중 줄별 버림과 달라지는 것이 있을 수 있음"
recommended_next: null
knowledge_candidates:
  - "회계팀 부가세 규칙: 품목 줄마다 할인 적용 후 금액에 세율을 곱해 원 단위 버림, 그 합이 청구서 부가세. 합계에서 다시 반올림하지 않음 (사람)"
---
## 요약
청구서 부가세를 줄별 버림 방식으로 바꾸는 버그 수정 의도를 정리했다. INV-2031은 합계 29,082원에서 29,079원이 되어야 한다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js:27`: `Math.round((taxable * VAT_RATE_PERCENT) / 100)`로 합계 기준 반올림 중. 줄별 net(`lineAmounts`)에 과세 여부가 있다.
- `src/invoice/credit-note.js:90`: 같은 방식의 부가세 계산 (이번 범위 밖, 위험 참고)
- `src/invoice/invoice.js:35`: 발행 시 `computeTotals` 결과를 `totals`에 저장
- 테스트: `npm test`, 확인: `node src/cli.js examples/INV-2031.json --totals`

---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 과세 품목 줄마다 할인 후 금액에 원 단위 버림으로 구하고 그 합을 쓴다. 합계에서 다시 반올림하지 않는다"
    why: "사람이 회계팀 규칙으로 알려 줌. INV-2031 합계 29,079원"
    by: human
  - what: "반품 전표 부가세는 이번 범위에서 제외"
    why: "사람이 '청구서만'을 선택"
    by: human
assumptions:
  - "면세 품목과 영세율 청구서는 기존대로 부가세 0 (회계팀 규칙에 따로 언급 없음)"
rejected:
  - "합계 단위 버림: 2,643원, 합계 29,081원이라 회계팀 29,079원과 다름"
open_questions: []
intent_deviation: null
risks:
  - "반품 전표(src/invoice/credit-note.js:90)는 여전히 합계 기준 반올림이라 원 청구서와 부가세가 1~수 원 어긋날 수 있음"
recommended_next: null
knowledge_candidates:
  - "회계팀 부가세 규칙: 품목 줄마다 할인 적용 후 금액의 부가세를 원 단위 버림으로 구하고 합산한다. 합계에서 다시 반올림하지 않는다. INV-2031 합계는 29,079원 (사람)"
  - "아직 규칙을 따르지 않음: src/invoice/credit-note.js — 부가세를 합계 기준 Math.round로 계산, 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
청구서 부가세가 합계 기준 반올림이라 회계팀보다 커진다. 회계팀 규칙(줄별 버림 합산)을 의도로 정리했다. 범위는 청구서만이다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js:28`: `Math.round((taxable * VAT_RATE_PERCENT) / 100)`가 합계 기준 반올림. `lineAmounts`의 `net`, `taxable`을 줄별 부가세에 쓸 수 있음
- INV-2031 수치: 줄 공급가 5368/6335/3255/8375/3105(합 26,438), 줄별 버림 부가세 536/633/325/837/310 = 2,641, 합계 29,079
- 같은 합계 기준 반올림이 `src/invoice/credit-note.js:90`에도 있으나 이번 범위 밖
- 테스트: `npm test`, 관련 파일 `test/total.test.js`, `test/invoice.test.js`

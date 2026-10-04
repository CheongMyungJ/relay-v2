---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 품목 줄마다 절사 후 합산한다"
    why: "사람 답변: 회계팀 방식. INV-2031 기대값 29,079원"
    by: human
  - what: "비목표는 요청의 두 가지(발행 청구서 재계산 안 함, src/format/ 불변)로 충분하다"
    why: "사람이 충분하다고 답함"
    by: human
assumptions:
  - "절사 대상은 할인 반영 후 과세 줄의 공급가액 × 10%이다"
  - "다른 청구서에 회계팀 기준값은 따로 없다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "크레딧노트, 견적서 등 computeTotals를 쓰는 다른 곳의 합계도 함께 바뀔 수 있다"
  - "src/money.js의 percentOf는 반올림이라 줄별 절사에 그대로 쓰면 안 된다"
recommended_next: null
knowledge_candidates:
  - "부가세는 품목 줄마다 원 미만 절사 후 합산한다 (회계팀 기준) (사람)"
---
## 요약
INV-2031 합계가 회계팀보다 3원 큰 문제의 의도를 정리했다. 부가세를 줄별 절사로 바꾸는 것이 기대 동작이다.
## 다음 task가 알아야 할 것
- `src/invoice/total.js:26`: 현재 `Math.round(taxable * 10 / 100)`로 합계 기준 반올림 (2,643.8 → 2,644).
- INV-2031 공급가액 26,438원. 줄별 부가세 536.8, 633.5, 325.5, 837.5, 310.5 → 절사 합 2,641.
- 시험 명령: `npm test` (node --test). 테스트는 `test/total.test.js`.
- 이 줄별 절사가 원인이라는 확정은 아님. fix에서 확인할 것.

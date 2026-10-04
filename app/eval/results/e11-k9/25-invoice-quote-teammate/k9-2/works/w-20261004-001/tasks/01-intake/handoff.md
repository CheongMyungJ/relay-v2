---
status: awaiting_approval
blocked_reason:
decisions:
  - what: "부가세는 품목 줄마다 원 미만 버림 후 합산한다 (INV-2031 합계 29,079원)"
    why: "사람이 선택지에서 고름"
    by: human
  - what: "범위는 청구서 합계만. 견적서·반품 전표는 비목표"
    why: "사람이 선택함"
    by: human
assumptions:
  - "면세 줄과 영세율 청구서의 기존 동작은 유지한다"
rejected: []
open_questions: []
intent_deviation: null
risks:
  - "회계팀의 공식 계산 기준을 문서로 확인하지 못함. 다른 예시 청구서로 대조하면 좋음"
  - "반품 전표(src/invoice/credit-note.js)는 부가세를 돌려주므로 청구서와 계산 방식이 어긋날 수 있음"
recommended_next: null
knowledge_candidates:
  - "청구서 부가세는 품목 줄마다 원 미만 버림 후 합산한다 (사람)"
  - "아직 규칙을 따르지 않음: 견적서와 반품 전표 금액 — 부가세 계산 방식 미확인, 사람이 이번 범위에서 뺌 (사람)"
---
## 요약
청구서 합계가 회계팀보다 크게 나오는 문제의 의도 초안을 썼다. 사람이 부가세를 줄별 버림 합산으로 정했고, 범위는 청구서 합계만이다.
## 다음 task가 알아야 할 것
- 계산 위치: `src/invoice/total.js`의 `computeTotals`, 부가세는 전체 과세분에 `Math.round`로 한 번 계산 (참고, 원인 확정 아님).
- INV-2031: 공급가액 26,438원, 줄별 부가세 버림 합 2,641원, 현재 2,644원.
- 확인 명령: `node src/cli.js examples/INV-2031.json --totals`, `npm test` (`test/total.test.js`에 vat 기대값 있음).
- 발행된 청구서는 저장된 `totals`를 쓰므로 재계산 경로를 건드리지 않는다.
